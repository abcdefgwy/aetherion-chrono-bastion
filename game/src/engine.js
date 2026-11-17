/**
 * 游戏主引擎模块
 * 负责主循环、WASD+Mouse 双摇杆控制、碰撞判定、技能释放、
 * 波次推进、UI 状态同步及 ?scene= 截图预览参数支持
 */

import { ChronoAudioSynth } from './audio-synth.js';
import {
  AUGMENT_CARDS,
  SHIP_CLASSES,
  TURRET_BLUEPRINTS,
  pickDraftCards
} from './augments.js';
import {
  AetherCore,
  ChronoRift,
  EnemyUnit,
  FloatingText,
  LeviathanBoss,
  OrbitalBeam,
  Particle,
  PlayerShip,
  Projectile,
  ShardPickup,
  Shockwave,
  Turret
} from './entities.js';
import { BattlefieldRenderer } from './renderer.js';
import { WAVE_CONFIGS, WaveDirector } from './wave-ai.js';

export class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new BattlefieldRenderer(this.canvas);
    this.audio = new ChronoAudioSynth();

    this.worldWidth = 2200;
    this.worldHeight = 1500;
    this.camera = { x: 0, y: 0 };

    this.state = 'title'; // 'title' | 'playing' | 'paused' | 'draft' | 'victory' | 'defeat'
    this.selectedShipId = 'valkyrie';

    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };

    this.core = null;
    this.player = null;
    this.director = null;
    this.turrets = [];
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.shardsOnGround = [];
    this.rifts = [];
    this.particles = [];
    this.shockwaves = [];
    this.orbitalBeams = [];
    this.floatingTexts = [];

    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.shards = 45;
    this.kills = 0;
    this.turretsBuilt = 0;
    this.screenShake = 0;

    this.cooldownScale = 1;
    this.turretDamageMult = 1;
    this.turretRangeMult = 1;
    this.acquiredAugments = new Set();
    this.currentDraftCards = [];

    this.lastTime = 0;
    this.elapsedTime = 0;

    this.cacheDom();
    this.bindEvents();
    this.resizeCanvas();
    this.renderShipSelector();
    this.initDemoBackdrop();
    this.applySceneQueryParam();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  /** 缓存全部 UI DOM 引用 */
  cacheDom() {
    this.dom = {
      screenTitle: document.getElementById('screen-title'),
      hudCombat: document.getElementById('hud-combat'),
      modalDraft: document.getElementById('modal-draft'),
      modalPause: document.getElementById('modal-pause'),
      screenDebrief: document.getElementById('screen-debrief'),

      shipList: document.getElementById('ship-class-list'),
      btnLaunch: document.getElementById('btn-launch'),

      barHull: document.getElementById('bar-hull'),
      txtHull: document.getElementById('txt-hull'),
      barEnergy: document.getElementById('bar-energy'),
      txtEnergy: document.getElementById('txt-energy'),
      barCore: document.getElementById('bar-core'),
      txtCore: document.getElementById('txt-core'),

      txtWave: document.getElementById('txt-wave'),
      txtWaveTitle: document.getElementById('txt-wave-title'),
      bossBanner: document.getElementById('boss-banner'),
      barBoss: document.getElementById('bar-boss'),
      txtBossHp: document.getElementById('txt-boss-hp'),

      txtScore: document.getElementById('txt-score'),
      txtCombo: document.getElementById('txt-combo'),
      txtShards: document.getElementById('txt-shards'),
      txtTurrets: document.getElementById('txt-turrets'),

      btnAudio: document.getElementById('btn-audio'),
      btnPause: document.getElementById('btn-pause'),
      btnRestart: document.getElementById('btn-restart'),
      btnResume: document.getElementById('btn-resume'),
      btnQuitTitle: document.getElementById('btn-quit-title'),

      cdDash: document.getElementById('cd-dash'),
      cdRift: document.getElementById('cd-rift'),
      cdLance: document.getElementById('cd-lance'),
      slotTurret1: document.getElementById('slot-turret-1'),
      slotTurret2: document.getElementById('slot-turret-2'),
      slotTurret3: document.getElementById('slot-turret-3'),

      draftCards: document.getElementById('draft-cards'),

      debriefBadge: document.getElementById('debrief-badge'),
      debriefTitle: document.getElementById('debrief-title'),
      debriefRank: document.getElementById('debrief-rank'),
      debriefStats: document.getElementById('debrief-stats'),
      debriefMedals: document.getElementById('debrief-medals'),
      btnPlayAgain: document.getElementById('btn-play-again'),
      btnChangeShip: document.getElementById('btn-change-ship')
    };
  }

  /** 绑定键盘、鼠标与按钮事件 */
  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      this.keys.add(code);

      if (code === 'Space' && this.state === 'playing') {
        e.preventDefault();
        this.triggerDash();
      } else if (code === 'KeyQ' && this.state === 'playing') {
        this.triggerChronoRift();
      } else if (code === 'KeyE' && this.state === 'playing') {
        this.triggerOrbitalLance();
      } else if (code === 'Digit1' && this.state === 'playing') {
        this.deployTurret('pulse');
      } else if (code === 'Digit2' && this.state === 'playing') {
        this.deployTurret('aegis');
      } else if (code === 'Digit3' && this.state === 'playing') {
        this.deployTurret('tesla');
      } else if (code === 'KeyP' || code === 'Escape') {
        if (this.state === 'playing') this.setPaused(true);
        else if (this.state === 'paused') this.setPaused(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.audio.ensureContext();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });

    this.dom.btnLaunch.addEventListener('click', () => {
      this.audio.ensureContext();
      this.startNewRun();
    });

    this.dom.btnAudio.addEventListener('click', () => {
      const next = !this.audio.muted;
      this.audio.setMuted(next);
      this.dom.btnAudio.textContent = next ? 'AUDIO: OFF' : 'AUDIO: ON';
      this.dom.btnAudio.classList.toggle('is-muted', next);
      if (!next && this.state === 'playing') {
        this.audio.startBassline();
      }
    });

    this.dom.btnPause.addEventListener('click', () => {
      if (this.state === 'playing') this.setPaused(true);
      else if (this.state === 'paused') this.setPaused(false);
    });

    this.dom.btnResume.addEventListener('click', () => this.setPaused(false));
    this.dom.btnRestart.addEventListener('click', () => this.startNewRun());
    this.dom.btnQuitTitle.addEventListener('click', () => this.returnToTitle());
    this.dom.btnPlayAgain.addEventListener('click', () => this.startNewRun());
    this.dom.btnChangeShip.addEventListener('click', () => this.returnToTitle());
  }

  /** 调整 Canvas 分辨率匹配窗口 */
  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /** 渲染标题页 3 个可选舰船职业卡片 */
  renderShipSelector() {
    this.dom.shipList.innerHTML = '';
    for (const ship of Object.values(SHIP_CLASSES)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `ship-card${ship.id === this.selectedShipId ? ' is-selected' : ''}`;
      card.style.setProperty('--ship-accent', ship.color);

      const speedPct = Math.round((ship.speed / 340) * 100);
      const armorPct = Math.round((ship.maxHull / 180) * 100);
      const firePct = Math.round(((ship.damage * ship.multishot) / ship.fireRate / 200) * 100);

      card.innerHTML = `
        <div class="ship-card-head">
          <span class="ship-badge">${ship.badge}</span>
          <span class="ship-name">${ship.name}</span>
        </div>
        <div class="ship-role">${ship.role}</div>
        <p class="ship-summary">${ship.summary}</p>
        <div class="ship-stats">
          <div class="stat-row"><span>HULL</span><div class="stat-bar"><i style="width:${Math.min(100, armorPct)}%"></i></div></div>
          <div class="stat-row"><span>THRUST</span><div class="stat-bar"><i style="width:${Math.min(100, speedPct)}%"></i></div></div>
          <div class="stat-row"><span>FIREPOWER</span><div class="stat-bar"><i style="width:${Math.min(100, firePct)}%"></i></div></div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectedShipId = ship.id;
        this.renderShipSelector();
      });
      this.dom.shipList.appendChild(card);
    }
  }

  /** 标题页背景初始化，避免空黑画布 */
  initDemoBackdrop() {
    this.core = new AetherCore(this.worldWidth * 0.5, this.worldHeight * 0.5);
    this.player = null;
    this.camera.x = this.core.x - this.canvas.width * 0.5;
    this.camera.y = this.core.y - this.canvas.height * 0.5;
  }

  /** 启动全新一局战斗 */
  startNewRun() {
    const shipCfg = SHIP_CLASSES[this.selectedShipId] || SHIP_CLASSES.valkyrie;
    this.core = new AetherCore(this.worldWidth * 0.5, this.worldHeight * 0.5);
    this.player = new PlayerShip(this.core.x, this.core.y + 135, shipCfg);
    this.director = new WaveDirector(this.worldWidth, this.worldHeight);

    this.turrets = [];
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.shardsOnGround = [];
    this.rifts = [];
    this.particles = [];
    this.shockwaves = [];
    this.orbitalBeams = [];
    this.floatingTexts = [];

    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.shards = 45;
    this.kills = 0;
    this.turretsBuilt = 0;
    this.screenShake = 0;
    this.cooldownScale = 1;
    this.turretDamageMult = 1;
    this.turretRangeMult = 1;
    this.acquiredAugments.clear();

    const waveCfg = this.director.startWave(1);
    this.dom.txtWave.textContent = `1 / ${WAVE_CONFIGS.length}`;
    this.dom.txtWaveTitle.textContent = waveCfg.title;

    this.state = 'playing';
    this.syncScreens();
    this.updateHud();
    if (!this.audio.muted) {
      this.audio.startBassline();
    }
  }

  /** 返回舰船选择标题页 */
  returnToTitle() {
    this.state = 'title';
    this.audio.stopBassline();
    this.initDemoBackdrop();
    this.syncScreens();
  }

  /** 暂停或恢复游戏 */
  setPaused(paused) {
    if (paused && this.state === 'playing') {
      this.state = 'paused';
      this.audio.stopBassline();
    } else if (!paused && this.state === 'paused') {
      this.state = 'playing';
      if (!this.audio.muted) this.audio.startBassline();
    }
    this.syncScreens();
  }

  /** 同步 4 大 UI 界面可见性 */
  syncScreens() {
    this.dom.screenTitle.classList.toggle('is-hidden', this.state !== 'title');
    this.dom.hudCombat.classList.toggle(
      'is-hidden',
      this.state === 'title' || this.state === 'victory' || this.state === 'defeat'
    );
    this.dom.modalDraft.classList.toggle('is-hidden', this.state !== 'draft');
    this.dom.modalPause.classList.toggle('is-hidden', this.state !== 'paused');
    this.dom.screenDebrief.classList.toggle(
      'is-hidden',
      this.state !== 'victory' && this.state !== 'defeat'
    );
  }

  /** 主循环 */
  loop(timestamp) {
    const dt = Math.min(0.05, this.lastTime ? (timestamp - this.lastTime) / 1000 : 0.016);
    this.lastTime = timestamp;
    this.elapsedTime += dt;

    if (this.state === 'playing') {
      this.update(dt);
    } else if (this.core) {
      this.core.update(dt);
    }

    this.renderer.render(this, this.elapsedTime);
    requestAnimationFrame((ts) => this.loop(ts));
  }

  /** 战斗逻辑逐帧更新 */
  update(dt) {
    this.core.update(dt);
    this.updatePlayer(dt);
    this.updateCamera();

    this.director.updateSpawns(dt, this);
    this.director.updateEnemies(dt, this);

    this.updateTurrets(dt);
    this.updateRifts(dt);
    this.updateProjectiles(dt);
    this.updateCollisions(dt);
    this.updateEffects(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
    }

    this.checkWaveClear();
    this.updateHud();
  }

  /** 更新玩家移动、瞄准、射击与技能冷却 */
  updatePlayer(dt) {
    const p = this.player;
    p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegen * dt);
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (p.dashTimer > 0) p.dashTimer -= dt;
    if (p.riftTimer > 0) p.riftTimer -= dt;
    if (p.lanceTimer > 0) p.lanceTimer -= dt;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;

    if (p.dashActive > 0) {
      p.dashActive -= dt;
      p.x += p.dashDirX * p.speed * 2.9 * dt;
      p.y += p.dashDirY * p.speed * 2.9 * dt;
      this.spawnParticles(p.x, p.y, p.shipClass.color, 2, 70);
    } else {
      let mx = 0;
      let my = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;

      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
      }
      p.vx = mx * p.speed;
      p.vy = my * p.speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // 限制在战场边界内
    p.x = Math.max(28, Math.min(this.worldWidth - 28, p.x));
    p.y = Math.max(28, Math.min(this.worldHeight - 28, p.y));

    // 鼠标世界坐标朝向
    const worldMouseX = this.mouse.x + this.camera.x;
    const worldMouseY = this.mouse.y + this.camera.y;
    p.angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);

    // 左键连射
    if (this.mouse.down && p.fireTimer <= 0) {
      p.fireTimer = p.fireRate;
      this.firePlayerWeapon();
    }
  }

  /** 发射玩家主武器 */
  firePlayerWeapon() {
    const p = this.player;
    const count = p.multishot;
    const baseAngle = p.angle;

    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * p.spread;
      const jitter = (Math.random() - 0.5) * 0.025;
      const ang = baseAngle + offset + jitter;
      this.projectiles.push(
        new Projectile({
          x: p.x + Math.cos(ang) * 20,
          y: p.y + Math.sin(ang) * 20,
          vx: Math.cos(ang) * p.projectileSpeed,
          vy: Math.sin(ang) * p.projectileSpeed,
          damage: p.damage,
          radius: p.pierce > 0 ? 5.2 : 4.2,
          color: p.shipClass.color,
          isEnemy: false,
          pierce: p.pierce,
          life: 1.4
        })
      );
    }
    this.audio.playLaser(p.shipClass.id === 'chronos' ? 0.85 : 1.05);
  }

  /** Space 技能：相位冲刺 */
  triggerDash() {
    const p = this.player;
    if (p.dashTimer > 0) return;

    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyW')) dy -= 1;
    if (this.keys.has('KeyS')) dy += 1;
    if (this.keys.has('KeyA')) dx -= 1;
    if (this.keys.has('KeyD')) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      p.dashDirX = dx / len;
      p.dashDirY = dy / len;
    } else {
      p.dashDirX = Math.cos(p.angle);
      p.dashDirY = Math.sin(p.angle);
    }

    p.dashActive = 0.17;
    p.dashTimer = p.dashCooldown * this.cooldownScale;
    this.audio.playDash();
    this.shockwaves.push(new Shockwave(p.x, p.y, 75, p.shipClass.color, 0.25));
  }

  /** Q 技能：在鼠标位置展开时空裂隙 */
  triggerChronoRift() {
    const p = this.player;
    const cost = 32;
    if (p.riftTimer > 0 || p.energy < cost) return;

    p.energy -= cost;
    p.riftTimer = p.riftCooldown * this.cooldownScale;
    const wx = Math.max(90, Math.min(this.worldWidth - 90, this.mouse.x + this.camera.x));
    const wy = Math.max(90, Math.min(this.worldHeight - 90, this.mouse.y + this.camera.y));

    this.rifts.push(new ChronoRift(wx, wy, 175, 5.5, 38));
    this.shockwaves.push(new Shockwave(wx, wy, 185, '#b975ff', 0.45));
    this.audio.playTimeRift();
  }

  /** E 技能：轨道长矛高能穿透激光 */
  triggerOrbitalLance() {
    const p = this.player;
    const cost = 45;
    if (p.lanceTimer > 0 || p.energy < cost) return;

    p.energy -= cost;
    p.lanceTimer = p.lanceCooldown * this.cooldownScale;
    this.screenShake = Math.max(this.screenShake, 0.45);
    this.audio.playOrbitalLance();

    const len = 1100;
    const x2 = p.x + Math.cos(p.angle) * len;
    const y2 = p.y + Math.sin(p.angle) * len;
    this.orbitalBeams.push(new OrbitalBeam(p.x, p.y, x2, y2, '#7df9ff'));

    // 对光束路径上所有敌军造成高额贯穿伤害
    const lanceDamage = Math.round(p.damage * 5.2 + 95);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = this.pointToSegmentDist(e.x, e.y, p.x, p.y, x2, y2);
      if (d <= e.radius + 24) {
        this.damageEnemy(e, i, lanceDamage, '#7df9ff');
      }
    }
  }

  /** 1/2/3 键部署哨戒炮塔 */
  deployTurret(blueprintId) {
    const bp = TURRET_BLUEPRINTS[blueprintId];
    if (!bp) return;
    if (this.shards < bp.cost) {
      this.addFloatingText(this.player.x, this.player.y - 28, 'NEED SHARDS', '#ff4d6d');
      return;
    }

    this.shards -= bp.cost;
    this.turretsBuilt++;
    const tx = Math.max(60, Math.min(this.worldWidth - 60, this.player.x + Math.cos(this.player.angle) * 42));
    const ty = Math.max(60, Math.min(this.worldHeight - 60, this.player.y + Math.sin(this.player.angle) * 42));

    this.turrets.push(new Turret(tx, ty, bp));
    this.shockwaves.push(new Shockwave(tx, ty, 70, bp.color, 0.3));
    this.audio.playTurretDeploy();
    this.addFloatingText(tx, ty - 24, `${bp.shortName} ONLINE`, bp.color);
  }

  /** 更新炮塔索敌与攻击 */
  updateTurrets(dt) {
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      if (t.hp <= 0) {
        this.spawnParticles(t.x, t.y, t.color, 14, 160);
        this.turrets.splice(i, 1);
        continue;
      }
      if (t.beamFlash > 0) t.beamFlash -= dt;
      t.fireTimer -= dt;

      const range = t.blueprint.range * this.turretRangeMult;

      // Aegis 塔缓慢修复自身与核心
      if (t.id === 'aegis') {
        t.pulseTimer += dt;
        if (t.pulseTimer >= 1.0) {
          t.pulseTimer = 0;
          this.core.hp = Math.min(this.core.maxHp, this.core.hp + t.blueprint.healRate);
        }
      }

      if (t.fireTimer > 0) continue;

      // 寻找射程内最近敌军
      const inRange = [];
      for (let ei = 0; ei < this.enemies.length; ei++) {
        const e = this.enemies[ei];
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= range) {
          inRange.push({ enemy: e, index: ei, dist: d });
        }
      }
      if (inRange.length === 0) continue;
      inRange.sort((a, b) => a.dist - b.dist);

      t.fireTimer = t.blueprint.fireRate;
      const dmg = Math.round(t.blueprint.damage * this.turretDamageMult);
      t.angle = Math.atan2(inRange[0].enemy.y - t.y, inRange[0].enemy.x - t.x);
      t.beamTargets = [];
      t.beamFlash = 0.14;

      if (t.id === 'tesla') {
        const hits = inRange.slice(0, t.blueprint.chainCount);
        for (const h of hits) {
          t.beamTargets.push({ x: h.enemy.x, y: h.enemy.y });
          const idx = this.enemies.indexOf(h.enemy);
          if (idx !== -1) this.damageEnemy(h.enemy, idx, dmg, t.color);
        }
      } else if (t.id === 'aegis') {
        this.shockwaves.push(new Shockwave(t.x, t.y, range * 0.72, t.color, 0.35));
        for (const h of inRange) {
          const idx = this.enemies.indexOf(h.enemy);
          if (idx !== -1) this.damageEnemy(h.enemy, idx, dmg, t.color);
        }
      } else {
        const target = inRange[0].enemy;
        t.beamTargets.push({ x: target.x, y: target.y });
        const idx = this.enemies.indexOf(target);
        if (idx !== -1) this.damageEnemy(target, idx, dmg, t.color);
      }
    }
  }

  /** 更新时空裂隙持续伤害 */
  updateRifts(dt) {
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const r = this.rifts[i];
      r.duration -= dt;
      r.spin += dt * 2.6;
      if (r.duration <= 0) {
        this.rifts.splice(i, 1);
        continue;
      }

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        const dist = Math.hypot(e.x - r.x, e.y - r.y);
        if (dist <= r.radius) {
          if (e.takeDamage(r.dps * dt)) {
            this.handleEnemyKilled(e, ei);
          }
        }
      }
    }
  }

  /** 更新所有飞行弹丸 */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (
        p.life <= 0 ||
        p.x < 0 ||
        p.x > this.worldWidth ||
        p.y < 0 ||
        p.y > this.worldHeight
      ) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /** 处理所有碰撞与拾取 */
  updateCollisions(dt) {
    // 1. 弹丸碰撞
    for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
      const proj = this.projectiles[pi];
      let removed = false;

      if (!proj.isEnemy) {
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
          const e = this.enemies[ei];
          if (proj.hitSet.has(e)) continue;
          const d = Math.hypot(proj.x - e.x, proj.y - e.y);
          if (d <= proj.radius + e.radius) {
            proj.hitSet.add(e);
            this.damageEnemy(e, ei, proj.damage, proj.color);
            if (proj.pierce > 0) {
              proj.pierce -= 1;
            } else {
              this.projectiles.splice(pi, 1);
              removed = true;
              break;
            }
          }
        }
      } else {
        // 敌军弹丸击中玩家
        if (Math.hypot(proj.x - this.player.x, proj.y - this.player.y) <= proj.radius + this.player.radius) {
          this.projectiles.splice(pi, 1);
          removed = true;
          this.damagePlayer(proj.damage);
        } else if (Math.hypot(proj.x - this.core.x, proj.y - this.core.y) <= proj.radius + this.core.radius) {
          this.projectiles.splice(pi, 1);
          removed = true;
          if (this.core.takeDamage(proj.damage)) {
            this.endGame(false);
            return;
          }
        }
      }
      if (removed) continue;
    }

    // 2. 敌军本体撞击玩家、炮塔、核心
    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const e = this.enemies[ei];

      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= e.radius + this.player.radius) {
        this.damagePlayer(e.type === 'leviathan' ? 28 : e.damage);
      }

      if (Math.hypot(e.x - this.core.x, e.y - this.core.y) <= e.radius + this.core.radius) {
        if (e.type === 'leviathan') {
          this.core.takeDamage(25 * dt);
        } else {
          const destroyed = this.core.takeDamage(e.damage * 1.35);
          this.spawnParticles(e.x, e.y, '#ff4d6d', 12, 160);
          this.enemies.splice(ei, 1);
          if (destroyed) {
            this.endGame(false);
            return;
          }
          continue;
        }
      }

      for (const t of this.turrets) {
        if (Math.hypot(e.x - t.x, e.y - t.y) <= e.radius + t.radius) {
          t.hp -= 22 * dt;
        }
      }
    }

    // 3. 玩家磁力吸取时空碎片
    for (let si = this.shardsOnGround.length - 1; si >= 0; si--) {
      const s = this.shardsOnGround[si];
      s.life -= dt;
      if (s.life <= 0) {
        this.shardsOnGround.splice(si, 1);
        continue;
      }
      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 145) {
        s.x += (dx / (dist || 1)) * 420 * dt;
        s.y += (dy / (dist || 1)) * 420 * dt;
      }
      if (dist <= this.player.radius + s.radius + 6) {
        this.shards += s.value;
        this.addFloatingText(s.x, s.y - 12, `+${s.value} SHARDS`, '#5ef2ff');
        this.shardsOnGround.splice(si, 1);
      }
    }
  }

  /** 对玩家造成伤害 */
  damagePlayer(amount) {
    if (this.player.takeDamage(amount)) {
      this.endGame(false);
    } else {
      this.screenShake = Math.max(this.screenShake, 0.25);
    }
  }

  /** 对敌军造成伤害 */
  damageEnemy(enemy, index, amount, color = '#ffffff') {
    this.spawnParticles(enemy.x, enemy.y, color, 4, 110);
    if (enemy.takeDamage(amount)) {
      this.handleEnemyKilled(enemy, index);
    }
  }

  /** 处理敌军被击破：积分、连击、掉落碎片与爆炸 */
  handleEnemyKilled(enemy, index) {
    this.enemies.splice(index, 1);
    this.kills++;
    this.comboTimer = 3.2;
    this.combo = Math.min(12, this.combo + 1);
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const gained = Math.round(enemy.score * (1 + (this.combo - 1) * 0.15));
    this.score += gained;
    this.shardsOnGround.push(new ShardPickup(enemy.x, enemy.y, enemy.shardValue));

    const isBoss = enemy.type === 'leviathan';
    this.spawnParticles(enemy.x, enemy.y, enemy.color, isBoss ? 48 : 14, isBoss ? 320 : 180);
    this.shockwaves.push(new Shockwave(enemy.x, enemy.y, isBoss ? 260 : 58, enemy.color, isBoss ? 0.65 : 0.28));
    this.addFloatingText(enemy.x, enemy.y - 14, `+${gained}`, '#ffb84d');
    this.audio.playExplosion(isBoss ? 2.2 : 1.0);

    if (isBoss) {
      this.boss = null;
      this.screenShake = 0.85;
    }
  }

  /** 检查波次清场并弹出 3 选 1 强化 */
  checkWaveClear() {
    if (this.director.pendingSpawns.length > 0 || this.enemies.length > 0) return;

    if (this.director.currentWave >= WAVE_CONFIGS.length) {
      this.endGame(true);
      return;
    }

    this.state = 'draft';
    this.audio.playUpgradeArpeggio();
    this.currentDraftCards = pickDraftCards(3, this.acquiredAugments);
    this.renderDraftModal();
    this.syncScreens();
  }

  /** 渲染波次通关 3 张 Roguelite 强化卡 */
  renderDraftModal() {
    this.dom.draftCards.innerHTML = '';
    for (const card of this.currentDraftCards) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'draft-card';
      el.style.setProperty('--card-accent', card.color);
      el.innerHTML = `
        <div class="draft-card-top">
          <span class="draft-tag">${card.tag}</span>
          <span class="draft-rarity">${card.rarity}</span>
        </div>
        <h3>${card.name}</h3>
        <p>${card.description}</p>
        <span class="draft-cta">INSTALL AUGMENT</span>
      `;
      el.addEventListener('click', () => this.chooseAugment(card));
      this.dom.draftCards.appendChild(el);
    }
  }

  /** 应用选中的强化卡并开启下一波 */
  chooseAugment(card) {
    card.apply(this);
    this.acquiredAugments.add(card.id);
    this.audio.playUpgradeArpeggio();

    const nextWave = this.director.currentWave + 1;
    const waveCfg = this.director.startWave(nextWave);
    this.dom.txtWave.textContent = `${nextWave} / ${WAVE_CONFIGS.length}`;
    this.dom.txtWaveTitle.textContent = waveCfg.title;

    this.state = 'playing';
    this.syncScreens();
    this.updateHud();
  }

  /** 结束游戏并展示胜利/战败结算界面 */
  endGame(victory) {
    this.state = victory ? 'victory' : 'defeat';
    this.audio.stopBassline();
    this.syncScreens();

    const corePct = Math.round((this.core.hp / this.core.maxHp) * 100);
    let rank = 'B';
    if (victory && corePct >= 80 && this.maxCombo >= 8) rank = 'S+';
    else if (victory && corePct >= 50) rank = 'S';
    else if (victory) rank = 'A';

    this.dom.debriefBadge.textContent = victory ? 'SECTOR SECURED' : 'BASTION FALLEN';
    this.dom.debriefBadge.className = `debrief-badge ${victory ? 'is-win' : 'is-loss'}`;
    this.dom.debriefTitle.textContent = victory ? 'VICTORY — CHRONO-BASTION INTACT' : 'DEFEAT — SIGNAL LOST';
    this.dom.debriefRank.textContent = rank;

    this.dom.debriefStats.innerHTML = `
      <div class="debrief-stat"><span>TOTAL SCORE</span><strong>${this.score.toLocaleString()}</strong></div>
      <div class="debrief-stat"><span>SECTOR WAVE</span><strong>${this.director.currentWave} / ${WAVE_CONFIGS.length}</strong></div>
      <div class="debrief-stat"><span>HOSTILES PURGED</span><strong>${this.kills}</strong></div>
      <div class="debrief-stat"><span>PEAK OVERDRIVE</span><strong>x${this.maxCombo}</strong></div>
      <div class="debrief-stat"><span>TURRETS DEPLOYED</span><strong>${this.turretsBuilt}</strong></div>
      <div class="debrief-stat"><span>CORE INTEGRITY</span><strong>${corePct}%</strong></div>
    `;

    const medals = [];
    if (victory) medals.push('Void Slayer');
    if (corePct >= 75) medals.push('Bastion Unbroken');
    if (this.maxCombo >= 8) medals.push('Overdrive Ace');
    if (this.turretsBuilt >= 3) medals.push('Chrono Architect');
    if (medals.length === 0) medals.push('First Sortie');

    this.dom.debriefMedals.innerHTML = medals
      .map((m) => `<span class="medal-chip">${m}</span>`)
      .join('');
  }

  /** 更新摄像机平滑跟随玩家 */
  updateCamera() {
    const targetX = this.player.x - this.canvas.width * 0.5;
    const targetY = this.player.y - this.canvas.height * 0.5;
    this.camera.x = Math.max(0, Math.min(this.worldWidth - this.canvas.width, targetX));
    this.camera.y = Math.max(0, Math.min(this.worldHeight - this.canvas.height, targetY));
  }

  /** 更新粒子、冲击波、光束与浮动文字 */
  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].life -= dt;
      if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.orbitalBeams.length - 1; i >= 0; i--) {
      this.orbitalBeams[i].life -= dt;
      if (this.orbitalBeams[i].life <= 0) this.orbitalBeams.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 28 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  /** 刷新战斗 HUD 数值与冷却进度 */
  updateHud() {
    if (!this.player || !this.core) return;
    const p = this.player;

    this.dom.barHull.style.width = `${Math.max(0, (p.hull / p.maxHull) * 100)}%`;
    this.dom.txtHull.textContent = `${Math.ceil(p.hull)} / ${p.maxHull}`;

    this.dom.barEnergy.style.width = `${Math.max(0, (p.energy / p.maxEnergy) * 100)}%`;
    this.dom.txtEnergy.textContent = `${Math.floor(p.energy)} / ${p.maxEnergy}`;

    this.dom.barCore.style.width = `${Math.max(0, (this.core.hp / this.core.maxHp) * 100)}%`;
    this.dom.txtCore.textContent = `${Math.ceil(this.core.hp)} / ${this.core.maxHp}`;

    this.dom.txtScore.textContent = this.score.toLocaleString();
    this.dom.txtCombo.textContent = `x${this.combo}`;
    this.dom.txtShards.textContent = String(this.shards);
    this.dom.txtTurrets.textContent = String(this.turrets.length);

    // Boss 血条横幅
    if (this.boss && this.boss.hp > 0) {
      this.dom.bossBanner.classList.remove('is-hidden');
      this.dom.barBoss.style.width = `${(this.boss.hp / this.boss.maxHp) * 100}%`;
      this.dom.txtBossHp.textContent = `PHASE ${this.boss.phase} · ${Math.ceil(this.boss.hp)} / ${this.boss.maxHp}`;
    } else {
      this.dom.bossBanner.classList.add('is-hidden');
    }

    // 技能冷却显示
    this.dom.cdDash.textContent = p.dashTimer > 0 ? `${p.dashTimer.toFixed(1)}s` : 'READY';
    this.dom.cdRift.textContent = p.riftTimer > 0 ? `${p.riftTimer.toFixed(1)}s` : '32 EN';
    this.dom.cdLance.textContent = p.lanceTimer > 0 ? `${p.lanceTimer.toFixed(1)}s` : '45 EN';

    this.dom.slotTurret1.classList.toggle('is-affordable', this.shards >= TURRET_BLUEPRINTS.pulse.cost);
    this.dom.slotTurret2.classList.toggle('is-affordable', this.shards >= TURRET_BLUEPRINTS.aegis.cost);
    this.dom.slotTurret3.classList.toggle('is-affordable', this.shards >= TURRET_BLUEPRINTS.tesla.cost);
  }

  /** 生成爆发粒子 */
  spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push(
        new Particle(
          x,
          y,
          Math.cos(ang) * spd,
          Math.sin(ang) * spd,
          color,
          1.8 + Math.random() * 2.8,
          0.25 + Math.random() * 0.35
        )
      );
    }
  }

  /** 添加浮动战斗提示文字 */
  addFloatingText(x, y, text, color) {
    this.floatingTexts.push(new FloatingText(x, y, text, color));
  }

  /** 点到线段距离（用于轨道长矛碰撞判定） */
  pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /** 支持 ?scene=title|combat|draft|victory 查询参数以便直接捕获各界面截图 */
  applySceneQueryParam() {
    const params = new URLSearchParams(window.location.search);
    const scene = params.get('scene');
    if (!scene || scene === 'title') return;

    this.startNewRun();
    this.audio.stopBassline();

    if (scene === 'combat') {
      this.director.startWave(5);
      this.dom.txtWave.textContent = '5 / 5';
      this.dom.txtWaveTitle.textContent = 'VOID LEVIATHAN';
      this.boss = new LeviathanBoss(this.core.x + 210, this.core.y - 140);
      this.boss.hp = 1840;
      this.enemies.push(
        this.boss,
        new EnemyUnit('swarmer', this.core.x - 160, this.core.y - 90, 1.3),
        new EnemyUnit('lancer', this.core.x + 170, this.core.y + 130, 1.3)
      );
      this.turrets.push(
        new Turret(this.core.x - 110, this.core.y + 70, TURRET_BLUEPRINTS.pulse),
        new Turret(this.core.x + 115, this.core.y + 65, TURRET_BLUEPRINTS.tesla)
      );
      this.rifts.push(new ChronoRift(this.core.x + 160, this.core.y - 80, 165, 4.5, 35));
      this.score = 4280;
      this.combo = 6;
      this.shards = 85;
      this.updateCamera();
      this.updateHud();
    } else if (scene === 'draft') {
      this.state = 'draft';
      this.currentDraftCards = AUGMENT_CARDS.slice(0, 3);
      this.renderDraftModal();
      this.syncScreens();
    } else if (scene === 'victory') {
      this.score = 12850;
      this.kills = 94;
      this.maxCombo = 10;
      this.turretsBuilt = 5;
      this.director.currentWave = 5;
      this.endGame(true);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameEngine();
});
