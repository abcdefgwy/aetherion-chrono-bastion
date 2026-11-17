/**
 * AETHERION: CHRONO-BASTION — 核心战斗实体模型
 * 包含：玩家战机、中央以太核心、自动防御哨塔、敌方舰队单元、虚空利维坦 Boss、弹道与碎片实体。
 */

export class AetherBastionCore {
  constructor(x, y, maxHp = 500) {
    this.x = x;
    this.y = y;
    this.radius = 44;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.shieldPulsePhase = 0;
    this.hitFlashTimer = 0;
  }

  applyCoreDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.22;
  }
}

export class PlayerInterceptorShip {
  constructor(x, y, loadout) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;
    this.aimAngle = -Math.PI / 2;
    this.chassisId = loadout.id;
    this.chassisName = loadout.name;
    this.weaponTitle = loadout.weaponTitle;
    this.primaryColor = loadout.primaryColor;

    this.maxHp = loadout.maxHull;
    this.hp = loadout.maxHull;
    this.energy = 100;
    this.maxEnergy = 100;

    this.moveSpeed = loadout.moveSpeed;
    this.fireInterval = loadout.fireInterval;
    this.fireTimer = 0;
    this.bulletDamage = loadout.bulletDamage;
    this.bulletSpeed = loadout.bulletSpeed;
    this.projectilesPerShot = loadout.projectilesPerShot;
    this.spreadAngle = loadout.spreadAngle;
    this.pierceCount = loadout.pierceCount;
    this.turretDamageMult = loadout.turretDamageMult;

    this.dashCooldown = 0;
    this.dashCooldownMax = 2.2;
    this.invulnerableTimer = 0;

    this.riftCooldown = 0;
    this.riftCooldownMax = 7.5;
    this.riftDuration = 4.5 + loadout.riftDurationBonus;
    this.riftDps = 28;

    this.lanceCooldown = 0;
    this.lanceCooldownMax = 9.0;
  }
}

export class DefenseTurretTower {
  constructor(x, y, blueprint) {
    this.x = x;
    this.y = y;
    this.kind = blueprint.kind;
    this.label = blueprint.label;
    this.range = blueprint.range;
    this.fireInterval = blueprint.fireInterval;
    this.fireTimer = 0.1;
    this.damage = blueprint.damage;
    this.coreHealPerSec = blueprint.coreHealPerSec || 0;
    this.chainTargets = blueprint.chainTargets || 1;
    this.color = blueprint.color;
    this.aimAngle = 0;
    this.laserBeamTimer = 0;
    this.lastTargetX = x;
    this.lastTargetY = y;
  }
}

export class EnemyArmadaUnit {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.vx = 0;
    this.vy = 0;
    this.archetype = config.archetype;
    this.label = config.label;
    this.radius = config.radius || 16;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.speed = config.speed;
    this.damage = config.damage;
    this.shardReward = config.shardReward;
    this.scoreReward = config.scoreReward;
    this.color = config.color;
    this.rangedCooldown = config.rangedCooldown || 0;
    this.rangedTimer = 1.4;
    this.slowFactor = 1.0;
    this.hitFlash = 0;
  }
}

export class VoidLeviathanBoss {
  constructor(x, y, waveScale = 1.0) {
    this.x = x;
    this.y = y;
    this.radius = 54;
    this.maxHp = Math.round(4500 * waveScale);
    this.hp = this.maxHp;
    this.speed = 62;
    this.phaseIndex = 1;
    this.orbitAngle = 0;
    this.salvoTimer = 1.8;
    this.laserSweepTimer = 4.5;
    this.summonTimer = 6.0;
    this.slowFactor = 1.0;
    this.hitFlash = 0;
  }
}

export class ProjectileBolt {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx;
    this.vy = config.vy;
    this.radius = config.radius || 5;
    this.damage = config.damage;
    this.isEnemy = Boolean(config.isEnemy);
    this.color = config.color || '#00f2fe';
    this.life = config.life || 1.6;
    this.pierceLeft = config.pierceLeft || 1;
    this.hitSet = new Set();
  }
}

export class ChronoShardPickup {
  constructor(x, y, value = 12) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = 8;
    this.life = 14.0;
    this.pulse = Math.random() * Math.PI * 2;
  }
}

export class ChronoStasisRiftZone {
  constructor(x, y, radius, duration, dps) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.duration = duration;
    this.maxDuration = duration;
    this.dps = dps;
    this.tickAcc = 0;
  }
}
