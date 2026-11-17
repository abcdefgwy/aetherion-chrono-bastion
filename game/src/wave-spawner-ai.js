/**
 * AETHERION: CHRONO-BASTION — 波次生成导演系统与敌舰/Boss 战术 AI 行为树
 */

import { EnemyArmadaUnit, VoidLeviathanBoss, ProjectileBolt } from './combat-entities.js';

export const ENEMY_ARCHETYPE_CATALOG = Object.freeze({
  swarmer: {
    archetype: 'swarmer',
    label: 'VOID SWARMER',
    radius: 13,
    maxHp: 48,
    speed: 135,
    damage: 14,
    shardReward: 8,
    scoreReward: 150,
    color: '#ff2a85',
    rangedCooldown: 0,
  },
  lancer: {
    archetype: 'lancer',
    label: 'PHANTOM LANCER',
    radius: 16,
    maxHp: 95,
    speed: 105,
    damage: 20,
    shardReward: 14,
    scoreReward: 320,
    color: '#ff7b00',
    rangedCooldown: 2.3,
  },
  crusher: {
    archetype: 'crusher',
    label: 'OBSIDIAN SIEGE HULL',
    radius: 23,
    maxHp: 230,
    speed: 64,
    damage: 36,
    shardReward: 24,
    scoreReward: 650,
    color: '#b84fce',
    rangedCooldown: 3.1,
  },
});

export class SectorWaveDirector {
  constructor() {
    this.currentWave = 1;
    this.maxWaves = 5;
    this.waveEnemiesTotal = 16;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesCleared = 0;
    this.spawnInterval = 1.15;
    this.spawnTimer = 0.4;
    this.bossSpawned = false;
  }

  /**
   * 初始化指定星区波次的兵力配比与生成节奏
   */
  configureSectorWave(waveNumber) {
    this.currentWave = waveNumber;
    this.waveEnemiesTotal = 12 + waveNumber * 6;
    this.waveEnemiesSpawned = 0;
    this.waveEnemiesCleared = 0;
    this.spawnInterval = Math.max(0.52, 1.22 - waveNumber * 0.13);
    this.spawnTimer = 0.35;
    this.bossSpawned = false;
  }

  /**
   * 在战场边缘生成新的敌方虚空舰队编队
   */
  spawnEnemyFormation(worldWidth, worldHeight, enemiesList) {
    const edgeAngle = Math.random() * Math.PI * 2;
    const spawnRadius = Math.hypot(worldWidth * 0.5, worldHeight * 0.5) - 20;
    const cx = worldWidth * 0.5 + Math.cos(edgeAngle) * spawnRadius;
    const cy = worldHeight * 0.5 + Math.sin(edgeAngle) * spawnRadius;

    const roll = Math.random();
    let template = ENEMY_ARCHETYPE_CATALOG.swarmer;
    if (this.currentWave >= 3 && roll > 0.72) {
      template = ENEMY_ARCHETYPE_CATALOG.crusher;
    } else if (this.currentWave >= 2 && roll > 0.42) {
      template = ENEMY_ARCHETYPE_CATALOG.lancer;
    }

    const hpScale = 1 + (this.currentWave - 1) * 0.22;
    const unit = new EnemyArmadaUnit({
      ...template,
      x: Math.max(30, Math.min(worldWidth - 30, cx)),
      y: Math.max(30, Math.min(worldHeight - 30, cy)),
      maxHp: Math.round(template.maxHp * hpScale),
    });
    enemiesList.push(unit);
    this.waveEnemiesSpawned += 1;
    return unit;
  }

  /**
   * 生成第 5 波终极旗舰：虚空利维坦无畏舰 (Void Leviathan MK-IV)
   */
  spawnLeviathanBossIfReady(worldWidth, worldHeight) {
    if (this.currentWave < 5 || this.bossSpawned) return null;
    this.bossSpawned = true;
    return new VoidLeviathanBoss(worldWidth * 0.5, 138, 1.0);
  }

  /**
   * 更新所有普通敌舰的寻路、减速力场响应与远程齐射逻辑
   */
  updateEnemyTacticalAI(dt, enemies, player, core, projectiles) {
    for (const enemy of enemies) {
      if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

      const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      const distToCore = Math.hypot(core.x - enemy.x, core.y - enemy.y);
      const target = distToPlayer < 190 ? player : core;

      const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      const effectiveSpeed = enemy.speed * enemy.slowFactor;
      enemy.vx = Math.cos(angle) * effectiveSpeed;
      enemy.vy = Math.sin(angle) * effectiveSpeed;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.slowFactor = 1.0;

      if (enemy.rangedCooldown > 0) {
        enemy.rangedTimer -= dt;
        if (enemy.rangedTimer <= 0 && distToCore < 480) {
          enemy.rangedTimer = enemy.rangedCooldown;
          const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          projectiles.push(
            new ProjectileBolt({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(aim) * 290,
              vy: Math.sin(aim) * 290,
              radius: 5,
              damage: 12,
              isEnemy: true,
              color: '#ff5e97',
              life: 2.4,
            })
          );
        }
      }
    }
  }

  /**
   * 更新虚空利维坦 Boss 的环绕机动与环形弹幕齐射行为
   */
  evaluateBossAttackPattern(dt, boss, player, core, projectiles, enemies) {
    if (!boss) return;
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    boss.phaseIndex = boss.hp < boss.maxHp * 0.5 ? 2 : 1;

    boss.orbitAngle += dt * 0.48 * boss.slowFactor;
    const targetX = core.x + Math.cos(boss.orbitAngle) * 235;
    const targetY = core.y + Math.sin(boss.orbitAngle) * 145;
    boss.x += (targetX - boss.x) * Math.min(1, dt * 2.2);
    boss.y += (targetY - boss.y) * Math.min(1, dt * 2.2);
    boss.slowFactor = 1.0;

    boss.salvoTimer -= dt;
    if (boss.salvoTimer <= 0) {
      boss.salvoTimer = boss.phaseIndex === 2 ? 1.25 : 1.75;
      const count = boss.phaseIndex === 2 ? 12 : 8;
      const baseAim = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = 0; i < count; i++) {
        const theta = baseAim + (i / count) * Math.PI * 2;
        projectiles.push(
          new ProjectileBolt({
            x: boss.x,
            y: boss.y,
            vx: Math.cos(theta) * 270,
            vy: Math.sin(theta) * 270,
            radius: 6,
            damage: 15,
            isEnemy: true,
            color: '#ff2a85',
            life: 2.8,
          })
        );
      }
    }

    boss.summonTimer -= dt;
    if (boss.summonTimer <= 0 && enemies.length < 18) {
      boss.summonTimer = 5.5;
      for (let k = -1; k <= 1; k += 2) {
        enemies.push(
          new EnemyArmadaUnit({
            ...ENEMY_ARCHETYPE_CATALOG.swarmer,
            x: boss.x + k * 55,
            y: boss.y + 30,
            maxHp: 70,
          })
        );
      }
    }
  }
}
