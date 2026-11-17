/**
 * 5 波次生成编排与敌军/Boss AI 行为控制模块
 */

import { EnemyUnit, LeviathanBoss, Projectile, Shockwave } from './entities.js';

/** 5 个波次的敌人构成与缩放系数 */
export const WAVE_CONFIGS = [
  {
    wave: 1,
    title: 'SECTOR BREACH',
    spawnInterval: 1.05,
    scale: 1.0,
    queue: { swarmer: 11, lancer: 2, crusher: 0 },
    boss: false
  },
  {
    wave: 2,
    title: 'LANCER VANGUARD',
    spawnInterval: 0.92,
    scale: 1.15,
    queue: { swarmer: 14, lancer: 5, crusher: 1 },
    boss: false
  },
  {
    wave: 3,
    title: 'SIEGE FORMATION',
    spawnInterval: 0.82,
    scale: 1.32,
    queue: { swarmer: 16, lancer: 7, crusher: 3 },
    boss: false
  },
  {
    wave: 4,
    title: 'CHRONO TEMPEST',
    spawnInterval: 0.72,
    scale: 1.5,
    queue: { swarmer: 20, lancer: 9, crusher: 4 },
    boss: false
  },
  {
    wave: 5,
    title: 'VOID LEVIATHAN',
    spawnInterval: 1.15,
    scale: 1.6,
    queue: { swarmer: 10, lancer: 5, crusher: 2 },
    boss: true
  }
];

/** 波次导演与 AI 控制器 */
export class WaveDirector {
  constructor(worldWidth, worldHeight) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.currentWave = 1;
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1.0;
    this.waveScale = 1.0;
    this.bossSpawned = false;
  }

  /** 初始化指定波次的生成队列 */
  startWave(waveNumber) {
    this.currentWave = waveNumber;
    const cfg = WAVE_CONFIGS[Math.min(waveNumber - 1, WAVE_CONFIGS.length - 1)];
    this.spawnInterval = cfg.spawnInterval;
    this.waveScale = cfg.scale;
    this.spawnTimer = 0.6;
    this.bossSpawned = false;

    const list = [];
    for (let i = 0; i < cfg.queue.swarmer; i++) list.push('swarmer');
    for (let i = 0; i < cfg.queue.lancer; i++) list.push('lancer');
    for (let i = 0; i < cfg.queue.crusher; i++) list.push('crusher');

    // 洗牌打乱出场顺序
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.pendingSpawns = list;
    return cfg;
  }

  /** 在战场边缘随机生成坐标 */
  randomEdgePoint(margin = 50) {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: Math.random() * this.worldWidth, y: margin };
    if (side === 1) return { x: this.worldWidth - margin, y: Math.random() * this.worldHeight };
    if (side === 2) return { x: Math.random() * this.worldWidth, y: this.worldHeight - margin };
    return { x: margin, y: Math.random() * this.worldHeight };
  }

  /** 每帧推进生成队列 */
  updateSpawns(dt, engine) {
    const cfg = WAVE_CONFIGS[Math.min(this.currentWave - 1, WAVE_CONFIGS.length - 1)];

    if (cfg.boss && !this.bossSpawned) {
      this.bossSpawned = true;
      const boss = new LeviathanBoss(this.worldWidth * 0.5, 130);
      engine.enemies.push(boss);
      engine.boss = boss;
      engine.shockwaves.push(new Shockwave(boss.x, boss.y, 220, '#ff2e93', 0.65));
      engine.addFloatingText(boss.x, boss.y - 70, 'VOID LEVIATHAN ARRIVES', '#ff2e93');
    }

    if (this.pendingSpawns.length === 0) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      const type = this.pendingSpawns.pop();
      const pt = this.randomEdgePoint(48);
      engine.enemies.push(new EnemyUnit(type, pt.x, pt.y, this.waveScale));
    }
  }

  /** 更新所有敌军与 Boss 的 AI 行为 */
  updateEnemies(dt, engine) {
    const { player, core } = engine;

    for (const enemy of engine.enemies) {
      if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

      // 重置并检查是否处于 Chrono-Rift 减速场内
      enemy.slowFactor = 1;
      for (const rift of engine.rifts) {
        const dx = enemy.x - rift.x;
        const dy = enemy.y - rift.y;
        if (dx * dx + dy * dy <= rift.radius * rift.radius) {
          enemy.slowFactor = 0.42;
          break;
        }
      }

      if (enemy.type === 'leviathan') {
        this.updateLeviathanAI(enemy, dt, engine);
        continue;
      }

      // 决定追踪目标（Swarmer 优先追击距离更近的玩家或核心，Crusher 锁定核心）
      const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      const distCore = Math.hypot(core.x - enemy.x, core.y - enemy.y);

      let target = core;
      if (enemy.type === 'swarmer' && distPlayer < distCore * 0.92) {
        target = player;
      } else if (enemy.type === 'lancer' && distPlayer < 460) {
        target = player;
      }

      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      enemy.angle = Math.atan2(dy, dx);

      const moveSpeed = enemy.speed * enemy.slowFactor;

      if (enemy.type === 'lancer') {
        // Lancer 保持中距离风筝并射击等离子弹
        if (dist > enemy.preferredRange + 35) {
          enemy.vx = nx * moveSpeed;
          enemy.vy = ny * moveSpeed;
        } else if (dist < enemy.preferredRange - 60) {
          enemy.vx = -nx * moveSpeed * 0.7;
          enemy.vy = -ny * moveSpeed * 0.7;
        } else {
          // 切向绕飞
          enemy.vx = -ny * moveSpeed * 0.65;
          enemy.vy = nx * moveSpeed * 0.65;
        }

        enemy.fireTimer -= dt * enemy.slowFactor;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = 1.9;
          engine.projectiles.push(
            new Projectile({
              x: enemy.x + nx * 22,
              y: enemy.y + ny * 22,
              vx: nx * 360,
              vy: ny * 360,
              damage: enemy.damage,
              radius: 5.5,
              color: '#ff9248',
              isEnemy: true,
              life: 2.6
            })
          );
        }
      } else {
        enemy.vx = nx * moveSpeed;
        enemy.vy = ny * moveSpeed;
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
  }

  /** Wave 5 Void Leviathan 多阶段 Boss AI */
  updateLeviathanAI(boss, dt, engine) {
    const { player, core } = engine;
    const dxCore = core.x - boss.x;
    const dyCore = core.y - boss.y;
    const distCore = Math.hypot(dxCore, dyCore) || 1;
    const desiredOrbit = 320;

    // 围绕 Aether Core 盘旋压迫
    const nx = dxCore / distCore;
    const ny = dyCore / distCore;
    const radialPull = distCore > desiredOrbit ? 0.65 : distCore < desiredOrbit - 60 ? -0.45 : 0;
    const speed = boss.speed * boss.slowFactor * (boss.phase >= 2 ? 1.2 : 1);

    boss.vx = (nx * radialPull - ny * 0.85) * speed;
    boss.vy = (ny * radialPull + nx * 0.85) * speed;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.angle = Math.atan2(player.y - boss.y, player.x - boss.x);

    // 阶段弹幕攻击
    boss.attackTimer -= dt * boss.slowFactor;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.phase === 3 ? 0.85 : boss.phase === 2 ? 1.15 : 1.45;
      const count = boss.phase === 3 ? 12 : boss.phase === 2 ? 9 : 6;
      boss.spiralAngle += 0.38;

      for (let i = 0; i < count; i++) {
        const ang = boss.spiralAngle + (Math.PI * 2 * i) / count;
        engine.projectiles.push(
          new Projectile({
            x: boss.x + Math.cos(ang) * 44,
            y: boss.y + Math.sin(ang) * 44,
            vx: Math.cos(ang) * (270 + boss.phase * 35),
            vy: Math.sin(ang) * (270 + boss.phase * 35),
            damage: 14 + boss.phase * 2,
            radius: 6.5,
            color: i % 2 === 0 ? '#ff2e93' : '#b975ff',
            isEnemy: true,
            life: 3.4
          })
        );
      }

      // 第二阶段起追加锁定玩家的三连狙击弹
      if (boss.phase >= 2) {
        const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
        for (const offset of [-0.14, 0, 0.14]) {
          const a = aim + offset;
          engine.projectiles.push(
            new Projectile({
              x: boss.x + Math.cos(a) * 52,
              y: boss.y + Math.sin(a) * 52,
              vx: Math.cos(a) * 410,
              vy: Math.sin(a) * 410,
              damage: 16,
              radius: 6,
              color: '#ff9248',
              isEnemy: true,
              life: 2.8
            })
          );
        }
      }
    }

    // 召唤虚空蜂群护卫
    boss.summonTimer -= dt;
    if (boss.summonTimer <= 0) {
      boss.summonTimer = boss.phase === 3 ? 5.0 : 7.0;
      const summonCount = boss.phase === 3 ? 3 : 2;
      for (let i = 0; i < summonCount; i++) {
        const ang = (Math.PI * 2 * i) / summonCount + Math.random() * 0.5;
        engine.enemies.push(
          new EnemyUnit(
            'swarmer',
            boss.x + Math.cos(ang) * 85,
            boss.y + Math.sin(ang) * 85,
            1.25
          )
        );
      }
      engine.shockwaves.push(new Shockwave(boss.x, boss.y, 130, '#b975ff', 0.4));
    }
  }
}
