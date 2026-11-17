/**
 * 游戏核心实体定义模块
 * 包含：AetherCore, PlayerShip, Turret, EnemyUnit, LeviathanBoss,
 * Projectile, ShardPickup, ChronoRift 及视觉特效实体
 */

/** 中央以太核心（需要全力守护的堡垒目标） */
export class AetherCore {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 52;
    this.maxHp = 500;
    this.hp = 500;
    this.pulsePhase = 0;
    this.hitFlash = 0;
  }

  /** 承受伤害并返回是否被摧毁 */
  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.22;
    return this.hp <= 0;
  }

  update(dt) {
    this.pulsePhase += dt * 1.8;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }
}

/** 玩家操控的截击机实体 */
export class PlayerShip {
  constructor(x, y, shipClass) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = 18;
    this.shipClass = shipClass;

    this.maxHull = shipClass.maxHull;
    this.hull = shipClass.maxHull;
    this.speed = shipClass.speed;
    this.fireRate = shipClass.fireRate;
    this.damage = shipClass.damage;
    this.projectileSpeed = shipClass.projectileSpeed;
    this.spread = shipClass.spread;
    this.multishot = shipClass.multishot;
    this.pierce = shipClass.pierce;

    this.maxEnergy = shipClass.maxEnergy;
    this.energy = shipClass.maxEnergy;
    this.energyRegen = shipClass.energyRegen;

    this.fireTimer = 0;
    this.dashCooldown = shipClass.dashCooldown;
    this.dashTimer = 0;
    this.dashActive = 0;
    this.dashDirX = 0;
    this.dashDirY = 0;

    this.riftCooldown = 7.5;
    this.riftTimer = 0;
    this.lanceCooldown = 11.0;
    this.lanceTimer = 0;

    this.invulnTimer = 0;
    this.hitFlash = 0;
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0 || this.dashActive > 0) return false;
    this.hull = Math.max(0, this.hull - amount);
    this.hitFlash = 0.2;
    this.invulnTimer = 0.35;
    return this.hull <= 0;
  }
}

/** 可部署哨戒炮塔 */
export class Turret {
  constructor(x, y, blueprint) {
    this.x = x;
    this.y = y;
    this.blueprint = blueprint;
    this.id = blueprint.id;
    this.color = blueprint.color;
    this.radius = 18;
    this.maxHp = blueprint.maxHp;
    this.hp = blueprint.maxHp;
    this.fireTimer = 0;
    this.angle = 0;
    this.beamTargets = [];
    this.beamFlash = 0;
    this.pulseTimer = 0;
  }
}

/** 敌方单位（Swarmer / Lancer / Siege Crusher） */
export class EnemyUnit {
  constructor(type, x, y, waveScale = 1) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.fireTimer = Math.random() * 1.2;
    this.hitFlash = 0;
    this.slowFactor = 1;

    if (type === 'swarmer') {
      this.name = 'Void Swarmer';
      this.radius = 14;
      this.maxHp = Math.round(34 * waveScale);
      this.speed = 165 + Math.random() * 25;
      this.damage = 12;
      this.score = 40;
      this.shardValue = 6;
      this.color = '#ff4d6d';
    } else if (type === 'lancer') {
      this.name = 'Chrono Lancer';
      this.radius = 19;
      this.maxHp = Math.round(68 * waveScale);
      this.speed = 115;
      this.damage = 16;
      this.score = 85;
      this.shardValue = 11;
      this.color = '#ff9248';
      this.preferredRange = 360;
    } else {
      // Siege Crusher
      this.name = 'Siege Crusher';
      this.radius = 28;
      this.maxHp = Math.round(185 * waveScale);
      this.speed = 76;
      this.damage = 28;
      this.score = 160;
      this.shardValue = 18;
      this.color = '#c74dff';
    }
    this.hp = this.maxHp;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 0.12;
    return this.hp <= 0;
  }
}

/** Wave 5 终极 Boss：Void Leviathan */
export class LeviathanBoss {
  constructor(x, y) {
    this.type = 'leviathan';
    this.name = 'VOID LEVIATHAN';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.radius = 58;
    this.maxHp = 2600;
    this.hp = 2600;
    this.speed = 68;
    this.phase = 1;
    this.spiralAngle = 0;
    this.attackTimer = 1.4;
    this.summonTimer = 5.5;
    this.dashTimer = 6.0;
    this.hitFlash = 0;
    this.slowFactor = 1;
    this.score = 1500;
    this.shardValue = 80;
    this.color = '#ff2e93';
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.1;
    if (this.hp < this.maxHp * 0.55) {
      this.phase = 2;
    }
    if (this.hp < this.maxHp * 0.25) {
      this.phase = 3;
    }
    return this.hp <= 0;
  }
}

/** 弹丸实体（友方或敌方） */
export class Projectile {
  constructor({ x, y, vx, vy, damage, radius, color, isEnemy = false, pierce = 0, life = 1.6 }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.radius = radius;
    this.color = color;
    this.isEnemy = isEnemy;
    this.pierce = pierce;
    this.life = life;
    this.hitSet = new Set();
  }
}

/** 时空碎片掉落物（用于部署炮塔） */
export class ShardPickup {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = 9;
    this.life = 16;
    this.bobPhase = Math.random() * Math.PI * 2;
  }
}

/** 时空裂隙场（Q 技能：减速敌军并持续造成虚空伤害） */
export class ChronoRift {
  constructor(x, y, radius = 165, duration = 5.2, dps = 34) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.duration = duration;
    this.maxDuration = duration;
    this.dps = dps;
    this.spin = 0;
  }
}

/** 粒子特效 */
export class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
  }
}

/** 扩散冲击波 */
export class Shockwave {
  constructor(x, y, maxRadius, color, duration = 0.45) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxRadius = maxRadius;
    this.color = color;
    this.duration = duration;
    this.life = duration;
  }
}

/** 轨道长矛穿透光束（E 技能视觉实体） */
export class OrbitalBeam {
  constructor(x1, y1, x2, y2, color = '#7df9ff') {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.color = color;
    this.life = 0.36;
    this.maxLife = 0.36;
  }
}

/** 浮动战斗数值文字 */
export class FloatingText {
  constructor(x, y, text, color = '#ffffff') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.78;
    this.maxLife = 0.78;
  }
}
