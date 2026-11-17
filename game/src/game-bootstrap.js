/**
 * AETHERION: CHRONO-BASTION — 游戏主循环、输入控制、状态机与 HUD 同步控制器
 */

import { ProceduralAudioSynthesizer } from './webaudio-synthesizer.js';
import {
  SHIP_CLASS_LOADOUTS,
  TACTICAL_TURRET_BLUEPRINTS,
  AugmentationDraftSystem,
} from './augment-synergy-draft.js';
import {
  AetherBastionCore,
  PlayerInterceptorShip,
  DefenseTurretTower,
  ProjectileBolt,
  ChronoShardPickup,
  ChronoStasisRiftZone,
} from './combat-entities.js';
import { SectorWaveDirector, ENEMY_ARCHETYPE_CATALOG } from './wave-spawner-ai.js';
import { ParticleVfxSystem, BattlefieldCanvasRenderer } from './canvas-vfx-renderer.js';

export class AetherionGameEngine {
  constructor() {
    this.canvas = document.getElementById('game-viewport-canvas');
    this.renderer = new BattlefieldCanvasRenderer(this.canvas);
    this.audio = new ProceduralAudioSynthesizer();
    this.vfx = new ParticleVfxSystem();
    this.waveDirector = new SectorWaveDirector();
    this.augmentDraft = new AugmentationDraftSystem();

    this.selectedChassisId = 'valkyrie';
    this.mode = 'title'; // 'title' | 'combat' | 'draft' | 'debrief'
    this.isPaused = false;
    this.elapsedTime = 0;

    this.keysDown = new Set();
    this.mousePos = { x: 640, y: 220 };
    this.mouseLeftDown = false;

    this.score = 0;
    this.combo = 1.0;
    this.peakCombo = 1.0;
    this.comboDecayTimer = 0;
    this.shards = 110;
    this.killsCount = 0;

    this.core = new AetherBastionCore(640, 360, 500);
    this.player = new PlayerInterceptorShip(640, 260, SHIP_CLASS_LOADOUTS.valkyrie);
    this.turrets = [];
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.shardPickups = [];
    this.rifts = [];

    this.bindDomAndInputEvents();
    this.populateBackgroundPreviewScene();
  }

  /**
   * 绑定键鼠事件、战机选择卡片、升级弹窗与重开按钮
   */
  bindDomAndInputEvents() {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.code);
      if (e.code === 'Enter' && this.mode === 'title') {
        this.startCampaignMission(this.selectedChassisId);
      } else if (e.code === 'Space' && this.mode === 'combat') {
        e.preventDefault();
        this.triggerPhaseDash();
      } else if (e.code === 'KeyQ' && this.mode === 'combat') {
        this.deployChronoRiftField();
      } else if (e.code === 'KeyE' && this.mode === 'combat') {
        this.fireOrbitalIonLance();
      } else if (e.code === 'Digit1' && this.mode === 'combat') {
        this.tryBuildTurret('pulse');
      } else if (e.code === 'Digit2' && this.mode === 'combat') {
        this.tryBuildTurret('pylon');
      } else if (e.code === 'Digit3' && this.mode === 'combat') {
        this.tryBuildTurret('tesla');
      } else if (e.code === 'KeyP') {
        this.isPaused = !this.isPaused;
      } else if (e.code === 'KeyM') {
        this.handleToggleAudio();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
      this.mousePos.y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.audio.ensureAudioContextReady();
      if (e.button === 0) this.mouseLeftDown = true;
      if (e.button === 2 && this.mode === 'combat') {
        e.preventDefault();
        this.triggerGravityPulseShockwave();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeftDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.querySelectorAll('.ship-class-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ship-class-card').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedChassisId = btn.dataset.classId || 'valkyrie';
        this.audio.playAugmentSelectSfx();
      });
    });

    document.getElementById('btn-launch-campaign')?.addEventListener('click', () => {
      this.audio.ensureAudioContextReady();
      this.startCampaignMission(this.selectedChassisId);
    });

    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.startCampaignMission(this.selectedChassisId);
    });

    document.getElementById('btn-return-command-deck')?.addEventListener('click', () => {
      this.setOverlayMode('title');
    });

    document.getElementById('btn-audio-toggle')?.addEventListener('click', () => {
      this.handleToggleAudio();
    });

    document.getElementById('btn-pause-game')?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
    });

    document.getElementById('btn-quick-restart')?.addEventListener('click', () => {
      this.startCampaignMission(this.selectedChassisId);
    });
  }

  handleToggleAudio() {
    const enabled = this.audio.toggleAudioMuteState();
    const btn = document.getElementById('btn-audio-toggle');
    if (btn) btn.textContent = enabled ? 'AUDIO: ON' : 'AUDIO: MUTED';
  }

  setOverlayMode(nextMode) {
    this.mode = nextMode;
    document.getElementById('title-screen-overlay')?.classList.toggle('active', nextMode === 'title');
    document.getElementById('tactical-augment-modal')?.classList.toggle('active', nextMode === 'draft');
    document.getElementById('campaign-debrief-screen')?.classList.toggle('active', nextMode === 'debrief');
  }

  /**
   * 启动全新战役并初始化玩家战机、以太核心与第 1 波敌军
   */
  startCampaignMission(chassisId = 'valkyrie') {
    const loadout = SHIP_CLASS_LOADOUTS[chassisId] || SHIP_CLASS_LOADOUTS.valkyrie;
    this.core = new AetherBastionCore(640, 360, loadout.coreMaxHp);
    this.player = new PlayerInterceptorShip(640, 250, loadout);
    this.turrets = [];
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.shardPickups = [];
    this.rifts = [];
    this.augmentDraft.installedAugmentTitles = [];

    this.score = 0;
    this.combo = 1.0;
    this.peakCombo = 1.0;
    this.shards = loadout.startingShards;
    this.killsCount = 0;
    this.elapsedTime = 0;
    this.isPaused = false;

    if (chassisId === 'aegis') {
      this.spawnFreeTurretNearCore('pulse');
    }

    this.waveDirector.configureSectorWave(1);
    this.setOverlayMode('combat');
    this.syncHudTelemetryDom();
  }

  spawnFreeTurretNearCore(kind = 'pulse') {
    const bp = TACTICAL_TURRET_BLUEPRINTS[kind] || TACTICAL_TURRET_BLUEPRINTS.pulse;
    const angle = (this.turrets.length * Math.PI) / 3 + 0.4;
    const tx = this.core.x + Math.cos(angle) * 112;
    const ty = this.core.y + Math.sin(angle) * 112;
    this.turrets.push(new DefenseTurretTower(tx, ty, bp));
  }

  tryBuildTurret(kind) {
    if (this.turrets.length >= 6) {
      this.vfx.spawnFloatingText(this.player.x, this.player.y - 20, 'MAX 6 TURRETS', '#ffb224');
      return;
    }
    const bp = TACTICAL_TURRET_BLUEPRINTS[kind];
    if (!bp || this.shards < bp.costShards) {
      this.vfx.spawnFloatingText(this.player.x, this.player.y - 20, 'NEED MORE SHARDS', '#ff2a85');
      return;
    }
    this.shards -= bp.costShards;
    this.turrets.push(new DefenseTurretTower(this.player.x, this.player.y, bp));
    this.vfx.spawnShockwaveRing(this.player.x, this.player.y, 65, bp.color);
    this.vfx.spawnFloatingText(this.player.x, this.player.y - 24, `+${bp.label}`, bp.color);
    this.audio.playAugmentSelectSfx();
  }

  triggerPhaseDash() {
    if (this.player.dashCooldown > 0) return;
    this.player.dashCooldown = this.player.dashCooldownMax;
    this.player.invulnerableTimer = 0.55;
    const angle = this.player.aimAngle;
    this.player.x = Math.max(40, Math.min(1240, this.player.x + Math.cos(angle) * 135));
    this.player.y = Math.max(60, Math.min(660, this.player.y + Math.sin(angle) * 135));
    this.vfx.spawnParticleBurst(this.player.x, this.player.y, '#10f59c', 18, 1.1);
    this.vfx.spawnFloatingText(this.player.x, this.player.y - 20, 'PHASE DASH!', '#10f59c');
  }

  deployChronoRiftField() {
    if (this.player.riftCooldown > 0) return;
    this.player.riftCooldown = this.player.riftCooldownMax;
    this.rifts.push(
      new ChronoStasisRiftZone(
        this.mousePos.x,
        this.mousePos.y,
        145,
        this.player.riftDuration,
        this.player.riftDps
      )
    );
    this.vfx.spawnShockwaveRing(this.mousePos.x, this.mousePos.y, 145, '#00f2fe');
    this.vfx.spawnFloatingText(this.mousePos.x, this.mousePos.y - 20, 'CHRONO STASIS RIFT!', '#00f2fe');
    this.audio.playTimeDilationSfx();
  }

  fireOrbitalIonLance() {
    if (this.player.lanceCooldown > 0) return;
    this.player.lanceCooldown = this.player.lanceCooldownMax;
    const tx = this.mousePos.x;
    const ty = this.mousePos.y;
    this.vfx.spawnShockwaveRing(tx, ty, 175, '#ffb224');
    this.vfx.spawnParticleBurst(tx, ty, '#ffb224', 28, 1.4);
    this.vfx.spawnFloatingText(tx, ty - 28, 'ORBITAL ION LANCE!', '#ffb224');
    this.audio.playOrbitalLanceSfx();

    for (const enemy of this.enemies) {
      if (Math.hypot(enemy.x - tx, enemy.y - ty) <= 175) {
        enemy.hp -= 160;
        enemy.hitFlash = 0.2;
      }
    }
    if (this.boss && Math.hypot(this.boss.x - tx, this.boss.y - ty) <= 210) {
      this.boss.hp -= 380;
      this.boss.hitFlash = 0.25;
    }
  }

  triggerGravityPulseShockwave() {
    if (this.player.energy < 35) return;
    this.player.energy -= 35;
    this.vfx.spawnShockwaveRing(this.player.x, this.player.y, 150, '#00f2fe');
    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (dist < 155 && dist > 1) {
        const pushAngle = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
        enemy.x += Math.cos(pushAngle) * 75;
        enemy.y += Math.sin(pushAngle) * 75;
        enemy.hp -= 32;
      }
    }
  }

  /**
   * 推进单帧物理模拟、碰撞检测、波次推进与胜负判定
   */
  updateSimulationStep(dt) {
    this.elapsedTime += dt;
    this.vfx.updateVfxFrame(dt);
    if (this.mode !== 'combat' || this.isPaused) return;

    this.audio.updateDynamicMusicSequencer(dt, true);

    // 1. 玩家移动与技能冷却
    let mx = 0;
    let my = 0;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) my -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) my += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) mx -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      this.player.x = Math.max(36, Math.min(1244, this.player.x + (mx / len) * this.player.moveSpeed * dt));
      this.player.y = Math.max(64, Math.min(656, this.player.y + (my / len) * this.player.moveSpeed * dt));
    }

    this.player.aimAngle = Math.atan2(this.mousePos.y - this.player.y, this.mousePos.x - this.player.x);
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 14 * dt);
    this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt);
    this.player.riftCooldown = Math.max(0, this.player.riftCooldown - dt);
    this.player.lanceCooldown = Math.max(0, this.player.lanceCooldown - dt);
    this.player.invulnerableTimer = Math.max(0, this.player.invulnerableTimer - dt);
    if (this.core.hitFlashTimer > 0) this.core.hitFlashTimer = Math.max(0, this.core.hitFlashTimer - dt);

    // 2. 玩家主武器齐射
    this.player.fireTimer = Math.max(0, this.player.fireTimer - dt);
    if (this.mouseLeftDown && this.player.fireTimer <= 0) {
      this.player.fireTimer = this.player.fireInterval;
      const n = this.player.projectilesPerShot;
      for (let i = 0; i < n; i++) {
        const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * this.player.spreadAngle;
        const theta = this.player.aimAngle + offset;
        this.projectiles.push(
          new ProjectileBolt({
            x: this.player.x + Math.cos(theta) * 20,
            y: this.player.y + Math.sin(theta) * 20,
            vx: Math.cos(theta) * this.player.bulletSpeed,
            vy: Math.sin(theta) * this.player.bulletSpeed,
            radius: 5,
            damage: this.player.bulletDamage,
            isEnemy: false,
            color: this.player.primaryColor,
            pierceLeft: this.player.pierceCount,
          })
        );
      }
      this.audio.playWeaponFireSfx(this.player.chassisId);
    }

    // 3. 时停裂隙力场减速与持续伤害
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const rift = this.rifts[i];
      rift.duration -= dt;
      rift.tickAcc += dt;
      const applyDot = rift.tickAcc >= 0.25;
      if (applyDot) rift.tickAcc = 0;

      for (const enemy of this.enemies) {
        if (Math.hypot(enemy.x - rift.x, enemy.y - rift.y) <= rift.radius) {
          enemy.slowFactor = 0.35;
          if (applyDot) enemy.hp -= rift.dps * 0.25;
        }
      }
      if (this.boss && Math.hypot(this.boss.x - rift.x, this.boss.y - rift.y) <= rift.radius + 30) {
        this.boss.slowFactor = 0.5;
        if (applyDot) this.boss.hp -= rift.dps * 0.25;
      }
      if (rift.duration <= 0) this.rifts.splice(i, 1);
    }

    // 4. 自动哨塔索敌与核心修复
    for (const turret of this.turrets) {
      if (turret.laserBeamTimer > 0) turret.laserBeamTimer = Math.max(0, turret.laserBeamTimer - dt);
      if (turret.coreHealPerSec > 0) {
        this.core.hp = Math.min(this.core.maxHp, this.core.hp + turret.coreHealPerSec * dt);
      }
      turret.fireTimer -= dt;
      if (turret.fireTimer <= 0) {
        let bestTarget = null;
        let bestDist = turret.range;
        for (const enemy of this.enemies) {
          const d = Math.hypot(enemy.x - turret.x, enemy.y - turret.y);
          if (d < bestDist) {
            bestDist = d;
            bestTarget = enemy;
          }
        }
        if (!bestTarget && this.boss) {
          const d = Math.hypot(this.boss.x - turret.x, this.boss.y - turret.y);
          if (d <= turret.range + 45) bestTarget = this.boss;
        }
        if (bestTarget) {
          turret.fireTimer = turret.fireInterval;
          turret.aimAngle = Math.atan2(bestTarget.y - turret.y, bestTarget.x - turret.x);
          turret.lastTargetX = bestTarget.x;
          turret.lastTargetY = bestTarget.y;
          turret.laserBeamTimer = 0.11;
          bestTarget.hp -= turret.damage * this.player.turretDamageMult;
          bestTarget.hitFlash = 0.1;
        }
      }
    }

    // 5. 生成敌舰与 Boss AI 更新
    if (this.waveDirector.waveEnemiesSpawned < this.waveDirector.waveEnemiesTotal) {
      this.waveDirector.spawnTimer -= dt;
      if (this.waveDirector.spawnTimer <= 0) {
        this.waveDirector.spawnTimer = this.waveDirector.spawnInterval;
        this.waveDirector.spawnEnemyFormation(this.canvas.width, this.canvas.height, this.enemies);
      }
    }
    if (this.waveDirector.currentWave === 5 && !this.waveDirector.bossSpawned) {
      this.boss = this.waveDirector.spawnLeviathanBossIfReady(this.canvas.width, this.canvas.height);
    }

    this.waveDirector.updateEnemyTacticalAI(dt, this.enemies, this.player, this.core, this.projectiles);
    this.waveDirector.evaluateBossAttackPattern(dt, this.boss, this.player, this.core, this.projectiles, this.enemies);

    // 6. 更新弹道与碰撞检测
    this.updateProjectilesAndCollisions(dt);

    // 7. 结算敌舰阵亡、掉落与波次晋级
    this.resolveDefeatedUnitsAndWaveProgression(dt);

    this.syncHudTelemetryDom();
  }

  updateProjectilesAndCollisions(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.x < 0 || p.x > 1280 || p.y < 0 || p.y > 720) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.isEnemy) {
        if (
          this.player.invulnerableTimer <= 0 &&
          Math.hypot(p.x - this.player.x, p.y - this.player.y) <= this.player.radius + p.radius
        ) {
          this.player.hp = Math.max(0, this.player.hp - p.damage);
          this.player.invulnerableTimer = 0.35;
          this.vfx.spawnParticleBurst(this.player.x, this.player.y, '#ff2a85', 10);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (Math.hypot(p.x - this.core.x, p.y - this.core.y) <= this.core.radius + p.radius) {
          this.core.applyCoreDamage(p.damage);
          this.projectiles.splice(i, 1);
          continue;
        }
      } else {
        let removed = false;
        for (const enemy of this.enemies) {
          if (!p.hitSet.has(enemy) && Math.hypot(p.x - enemy.x, p.y - enemy.y) <= enemy.radius + p.radius) {
            p.hitSet.add(enemy);
            enemy.hp -= p.damage;
            enemy.hitFlash = 0.12;
            p.pierceLeft -= 1;
            if (p.pierceLeft <= 0) {
              this.projectiles.splice(i, 1);
              removed = true;
              break;
            }
          }
        }
        if (!removed && this.boss && !p.hitSet.has(this.boss)) {
          if (Math.hypot(p.x - this.boss.x, p.y - this.boss.y) <= this.boss.radius + p.radius) {
            p.hitSet.add(this.boss);
            this.boss.hp -= p.damage;
            this.boss.hitFlash = 0.12;
            this.vfx.spawnParticleBurst(p.x, p.y, '#ffb224', 6, 0.7);
            this.projectiles.splice(i, 1);
          }
        }
      }
    }

    // 敌舰近身撞击核心或玩家
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (Math.hypot(enemy.x - this.core.x, enemy.y - this.core.y) <= enemy.radius + this.core.radius) {
        this.core.applyCoreDamage(enemy.damage);
        this.vfx.spawnParticleBurst(enemy.x, enemy.y, '#ff2a85', 12);
        this.enemies.splice(i, 1);
        this.waveDirector.waveEnemiesCleared += 1;
        continue;
      }
      if (
        this.player.invulnerableTimer <= 0 &&
        Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= enemy.radius + this.player.radius
      ) {
        this.player.hp = Math.max(0, this.player.hp - enemy.damage * 0.75);
        this.player.invulnerableTimer = 0.45;
      }
    }
  }

  resolveDefeatedUnitsAndWaveProgression(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.waveDirector.waveEnemiesCleared += 1;
        this.killsCount += 1;
        this.combo = Math.min(12.0, +(this.combo + 0.25).toFixed(2));
        this.peakCombo = Math.max(this.peakCombo, this.combo);
        this.comboDecayTimer = 4.5;
        const pts = Math.round(e.scoreReward * this.combo);
        this.score += pts;
        this.shardPickups.push(new ChronoShardPickup(e.x, e.y, e.shardReward));
        this.vfx.spawnParticleBurst(e.x, e.y, e.color, 15);
        this.vfx.spawnFloatingText(e.x, e.y - 12, `+${pts}`, '#ffb224');
        this.audio.playExplosionSfx(0.9);
      }
    }

    if (this.comboDecayTimer > 0) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) this.combo = 1.0;
    }

    // 玩家磁吸拾取 Chrono-Shards
    for (let i = this.shardPickups.length - 1; i >= 0; i--) {
      const s = this.shardPickups[i];
      s.life -= dt;
      const d = Math.hypot(this.player.x - s.x, this.player.y - s.y);
      if (d < 165) {
        s.x += ((this.player.x - s.x) / Math.max(1, d)) * 340 * dt;
        s.y += ((this.player.y - s.y) / Math.max(1, d)) * 340 * dt;
      }
      if (d < this.player.radius + s.radius + 8) {
        this.shards += s.value;
        this.shardPickups.splice(i, 1);
        continue;
      }
      if (s.life <= 0) this.shardPickups.splice(i, 1);
    }

    // 判定失败或胜利
    if (this.core.hp <= 0 || this.player.hp <= 0) {
      this.openCampaignDebrief(false);
      return;
    }

    if (this.boss && this.boss.hp <= 0) {
      this.score += Math.round(15000 * this.combo);
      this.killsCount += 1;
      this.vfx.spawnShockwaveRing(this.boss.x, this.boss.y, 260, '#ffb224');
      this.boss = null;
      this.audio.playExplosionSfx(1.8);
      this.openCampaignDebrief(true);
      return;
    }

    const allSpawned = this.waveDirector.waveEnemiesSpawned >= this.waveDirector.waveEnemiesTotal;
    if (allSpawned && this.enemies.length === 0 && !this.boss) {
      if (this.waveDirector.currentWave < this.waveDirector.maxWaves) {
        this.openAugmentationDraftModal();
      } else {
        this.openCampaignDebrief(true);
      }
    }
  }

  openAugmentationDraftModal() {
    this.core.hp = Math.min(this.core.maxHp, this.core.hp + 80);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
    const choices = this.augmentDraft.generateDraftChoices(this.waveDirector.currentWave);
    const container = document.getElementById('augment-cards-container');
    if (container) {
      container.innerHTML = '';
      choices.forEach((card, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'augment-card';
        btn.innerHTML = `
          <div>
            <div class="augment-rarity">${card.rarity}</div>
            <h3>${card.title}</h3>
            <p>${card.description}</p>
          </div>
          <div class="augment-stat-delta">${card.statDeltaText}</div>
        `;
        btn.addEventListener('click', () => {
          this.augmentDraft.applySelectedAugmentation(idx, this);
          this.audio.playAugmentSelectSfx();
          this.waveDirector.configureSectorWave(this.waveDirector.currentWave + 1);
          this.setOverlayMode('combat');
          this.syncHudTelemetryDom();
        });
        container.appendChild(btn);
      });
    }
    const installedEl = document.getElementById('installed-augments-summary');
    if (installedEl) {
      installedEl.textContent =
        this.augmentDraft.installedAugmentTitles.length > 0
          ? `INSTALLED MODULES: ${this.augmentDraft.installedAugmentTitles.join(' • ')}`
          : 'INSTALLED MODULES: NONE YET';
    }
    this.setOverlayMode('draft');
  }

  openCampaignDebrief(isVictory) {
    const headline = document.getElementById('debrief-headline');
    const subheadline = document.getElementById('debrief-subheadline');
    const gradeEl = document.getElementById('debrief-rank-grade');
    if (headline) {
      headline.textContent = isVictory
        ? 'AETHER CITADEL SECURED // CAMPAIGN VICTORY'
        : 'AETHER CORE BREACHED // MISSION FAILED';
    }
    if (subheadline) {
      subheadline.textContent = isVictory
        ? 'The Void Leviathan Dreadnought has been neutralized and the Aether Core remains online!'
        : 'Hostile Void Armada overwhelmed the sector defenses. Recalibrate loadout and relaunch.';
    }
    if (gradeEl) {
      gradeEl.textContent = isVictory ? (this.core.hp >= 350 ? 'S+' : 'S') : 'B';
    }
    document.getElementById('debrief-final-score').textContent = this.score.toLocaleString('en-US');
    document.getElementById('debrief-waves-cleared').textContent = `${
      isVictory ? 5 : this.waveDirector.currentWave - 1
    } / 5`;
    document.getElementById('debrief-kills-count').textContent = String(this.killsCount);
    document.getElementById('debrief-peak-combo').textContent = `x${this.peakCombo.toFixed(1)}`;
    document.getElementById('debrief-core-remaining').textContent = `${Math.round(this.core.hp)} / ${this.core.maxHp}`;
    this.setOverlayMode('debrief');
  }

  syncHudTelemetryDom() {
    const hullPct = Math.round((this.player.hp / this.player.maxHp) * 100);
    document.getElementById('player-hull-fill').style.width = `${hullPct}%`;
    document.getElementById('player-hull-text').textContent = `${Math.round(this.player.hp)} / ${this.player.maxHp}`;

    const energyPct = Math.round((this.player.energy / this.player.maxEnergy) * 100);
    document.getElementById('player-energy-fill').style.width = `${energyPct}%`;
    document.getElementById('player-energy-text').textContent = `${energyPct}%`;

    const corePct = Math.round((this.core.hp / this.core.maxHp) * 100);
    document.getElementById('bastion-core-fill').style.width = `${corePct}%`;
    document.getElementById('bastion-core-text').textContent = `${Math.round(this.core.hp)} / ${this.core.maxHp}`;

    document.getElementById('sector-wave-badge').textContent = `SECTOR WAVE ${this.waveDirector.currentWave} / 5`;
    const prog = Math.min(
      100,
      Math.round((this.waveDirector.waveEnemiesCleared / Math.max(1, this.waveDirector.waveEnemiesTotal)) * 100)
    );
    document.getElementById('wave-progress-fill').style.width = `${prog}%`;

    const mins = String(Math.floor(this.elapsedTime / 60)).padStart(2, '0');
    const secs = String(Math.floor(this.elapsedTime % 60)).padStart(2, '0');
    document.getElementById('mission-timer-text').textContent = `${mins}:${secs}`;

    const bossBanner = document.getElementById('boss-health-banner');
    if (this.boss) {
      bossBanner.classList.remove('hidden');
      const bpct = Math.max(0, Math.round((this.boss.hp / this.boss.maxHp) * 100));
      document.getElementById('boss-hp-fill').style.width = `${bpct}%`;
      document.getElementById('boss-hp-label').textContent = `${Math.max(0, Math.round(this.boss.hp))} / ${
        this.boss.maxHp
      } HP`;
    } else {
      bossBanner.classList.add('hidden');
    }

    document.getElementById('hud-score-value').textContent = this.score.toLocaleString('en-US');
    document.getElementById('hud-combo-value').textContent = `x${this.combo.toFixed(1)}`;
    document.getElementById('hud-shards-value').textContent = String(this.shards);
    document.getElementById('hud-turrets-value').textContent = `${this.turrets.length} / 6`;
  }

  /**
   * 填充封面背景或实机截图场景的动态战斗画面
   */
  populateBackgroundPreviewScene(preset = 'title') {
    this.startCampaignMission('valkyrie');
    this.elapsedTime = 84.5;
    this.score = 68450;
    this.combo = 6.5;
    this.peakCombo = 8.5;
    this.shards = 185;
    this.killsCount = 78;
    this.waveDirector.currentWave = 3;
    this.waveDirector.waveEnemiesTotal = 30;
    this.waveDirector.waveEnemiesSpawned = 22;
    this.waveDirector.waveEnemiesCleared = 16;

    this.spawnFreeTurretNearCore('pulse');
    this.spawnFreeTurretNearCore('pylon');
    this.spawnFreeTurretNearCore('tesla');
    this.turrets[0].laserBeamTimer = 0.5;
    this.turrets[0].lastTargetX = 430;
    this.turrets[0].lastTargetY = 230;

    this.rifts.push(new ChronoStasisRiftZone(455, 250, 135, 4.0, 35));
    const positions = [
      [430, 230, 'lancer'],
      [490, 195, 'swarmer'],
      [840, 240, 'crusher'],
      [880, 440, 'lancer'],
      [390, 480, 'swarmer'],
      [760, 520, 'swarmer'],
    ];
    for (const [x, y, kind] of positions) {
      const tpl = ENEMY_ARCHETYPE_CATALOG[kind];
      const u = this.waveDirector.spawnEnemyFormation(1280, 720, this.enemies);
      Object.assign(u, tpl, { x, y, hp: Math.round(tpl.maxHp * 0.72) });
    }

    for (let i = 0; i < 8; i++) {
      const a = -0.7 + i * 0.14;
      this.projectiles.push(
        new ProjectileBolt({
          x: this.player.x + Math.cos(a) * (45 + i * 18),
          y: this.player.y + Math.sin(a) * (45 + i * 18),
          vx: Math.cos(a) * 600,
          vy: Math.sin(a) * 600,
          radius: 5,
          damage: 28,
          isEnemy: false,
          color: '#00f2fe',
        })
      );
    }

    this.vfx.spawnParticleBurst(430, 230, '#00f2fe', 22, 0.8);
    this.vfx.spawnParticleBurst(840, 240, '#ffb224', 18, 0.8);
    this.vfx.spawnShockwaveRing(455, 250, 120, '#00f2fe');
    this.vfx.spawnFloatingText(430, 205, '+1,950 OVERDRIVE!', '#ffb224');
    this.vfx.spawnFloatingText(840, 215, 'CRITICAL HIT!', '#00f2fe');

    if (preset === 'title') {
      this.setOverlayMode('title');
    } else if (preset === 'combat') {
      this.boss = this.waveDirector.spawnLeviathanBossIfReady(1280, 720) || null;
      this.waveDirector.currentWave = 5;
      this.boss = this.waveDirector.spawnLeviathanBossIfReady(1280, 720);
      this.boss.hp = 3420;
      this.setOverlayMode('combat');
    } else if (preset === 'draft') {
      this.augmentDraft.installedAugmentTitles = ['HYPER-FLUX CAPACITORS', 'SENTINEL OVERSEER AI'];
      this.openAugmentationDraftModal();
    } else if (preset === 'victory') {
      this.score = 164800;
      this.killsCount = 148;
      this.peakCombo = 10.5;
      this.core.hp = 460;
      this.openCampaignDebrief(true);
    }
    this.syncHudTelemetryDom();
  }
}

export function initializeGameApplication() {
  const engine = new AetherionGameEngine();
  window.__aetherionEngine = engine;

  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get('scene');
  if (sceneParam) {
    engine.populateBackgroundPreviewScene(sceneParam);
  }

  let lastTs = performance.now();
  function animationFrameLoop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
    lastTs = now;
    if (!sceneParam) {
      engine.updateSimulationStep(dt);
    }
    engine.renderer.renderBattlefieldFrame(engine);
    requestAnimationFrame(animationFrameLoop);
  }
  requestAnimationFrame(animationFrameLoop);
}

initializeGameApplication();
