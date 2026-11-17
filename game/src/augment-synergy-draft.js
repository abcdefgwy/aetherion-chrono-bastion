/**
 * AETHERION: CHRONO-BASTION — 战机底盘配置、哨塔蓝图与 Roguelite 战术强化三选一系统
 */

export const SHIP_CLASS_LOADOUTS = Object.freeze({
  valkyrie: {
    id: 'valkyrie',
    name: 'VALKYRIE-IX',
    weaponTitle: 'PLASMA TWIN-CANNON',
    maxHull: 110,
    moveSpeed: 310,
    fireInterval: 0.12,
    bulletDamage: 26,
    bulletSpeed: 680,
    projectilesPerShot: 2,
    spreadAngle: 0.08,
    pierceCount: 1,
    startingShards: 110,
    coreMaxHp: 500,
    turretDamageMult: 1.0,
    riftDurationBonus: 0,
    primaryColor: '#00f2fe',
  },
  aegis: {
    id: 'aegis',
    name: 'AEGIS-VII GOLIATH',
    weaponTitle: 'HEAVY SCATTER-RAIL',
    maxHull: 155,
    moveSpeed: 265,
    fireInterval: 0.21,
    bulletDamage: 24,
    bulletSpeed: 640,
    projectilesPerShot: 4,
    spreadAngle: 0.22,
    pierceCount: 1,
    startingShards: 145,
    coreMaxHp: 650,
    turretDamageMult: 1.35,
    riftDurationBonus: 0,
    primaryColor: '#ffb224',
  },
  chronos: {
    id: 'chronos',
    name: 'CHRONOS-IV PHANTOM',
    weaponTitle: 'TACHYON PIERCE LANCE',
    maxHull: 100,
    moveSpeed: 330,
    fireInterval: 0.16,
    bulletDamage: 38,
    bulletSpeed: 820,
    projectilesPerShot: 1,
    spreadAngle: 0.0,
    pierceCount: 3,
    startingShards: 120,
    coreMaxHp: 500,
    turretDamageMult: 1.1,
    riftDurationBonus: 2.5,
    primaryColor: '#c471ed',
  },
});

export const TACTICAL_TURRET_BLUEPRINTS = Object.freeze({
  pulse: {
    kind: 'pulse',
    label: 'PULSE LASER TURRET',
    costShards: 40,
    range: 270,
    fireInterval: 0.34,
    damage: 22,
    color: '#00f2fe',
  },
  pylon: {
    kind: 'pylon',
    label: 'AEGIS HARMONIC PYLON',
    costShards: 55,
    range: 230,
    fireInterval: 0.75,
    damage: 16,
    coreHealPerSec: 4.5,
    color: '#10f59c',
  },
  tesla: {
    kind: 'tesla',
    label: 'TESLA ARC COIL',
    costShards: 70,
    range: 250,
    fireInterval: 0.55,
    damage: 34,
    chainTargets: 3,
    color: '#ffb224',
  },
});

export const ROLLABLE_AUGMENT_CARDS = Object.freeze([
  {
    id: 'hyper_capacitors',
    rarity: 'EPIC SYNERGY',
    title: 'HYPER-FLUX CAPACITORS',
    description: 'Overclocks primary weapon firing cycle and projectile velocity for relentless suppression.',
    statDeltaText: '+28% Fire Rate | +20% Projectile Speed',
    applyEffect(state) {
      state.player.fireInterval *= 0.78;
      state.player.bulletSpeed *= 1.2;
    },
  },
  {
    id: 'prismatic_splitter',
    rarity: 'LEGENDARY CORE',
    title: 'PRISMATIC BARREL SPLITTER',
    description: 'Adds an extra synchronized plasma stream to every primary weapon volley.',
    statDeltaText: '+1 Projectile Per Volley | +15% Damage',
    applyEffect(state) {
      state.player.projectilesPerShot += 1;
      state.player.bulletDamage = Math.round(state.player.bulletDamage * 1.15);
      state.player.spreadAngle = Math.max(0.12, state.player.spreadAngle + 0.04);
    },
  },
  {
    id: 'sentinel_overseer',
    rarity: 'TACTICAL MATRIX',
    title: 'SENTINEL OVERSEER AI',
    description: 'Links all Bastion Turrets to the Valkyrie targeting neural net and grants +70 Shards.',
    statDeltaText: '+40% Turret Damage | +70 Chrono-Shards',
    applyEffect(state) {
      state.player.turretDamageMult *= 1.4;
      state.shards += 70;
    },
  },
  {
    id: 'temporal_singularity',
    rarity: 'CHRONO TECH',
    title: 'TEMPORAL SINGULARITY CORE',
    description: 'Chrono-Rift fields deal continuous resonance damage and recharge 35% faster.',
    statDeltaText: '-35% Rift Cooldown | +45 DPS Inside Rift',
    applyEffect(state) {
      state.player.riftCooldownMax *= 0.65;
      state.player.riftDps += 45;
    },
  },
  {
    id: 'aegis_nanite_forge',
    rarity: 'BASTION DEFENSE',
    title: 'AEGIS NANITE CITADEL FORGE',
    description: 'Reinforces Aether Core maximum integrity and deploys an immediate free Pulse Turret.',
    statDeltaText: '+150 Core Max HP | +1 Free Pulse Turret',
    applyEffect(state) {
      state.core.maxHp += 150;
      state.core.hp = Math.min(state.core.maxHp, state.core.hp + 180);
      state.spawnFreeTurretNearCore('pulse');
    },
  },
  {
    id: 'tachyon_piercer',
    rarity: 'ASSAULT TECH',
    title: 'TACHYON PHASE-PIERCER',
    description: 'Rounds phase through multiple hostile hulls and detonate with kinetic shockwaves.',
    statDeltaText: '+2 Projectile Pierce | +25% Crit Damage',
    applyEffect(state) {
      state.player.pierceCount += 2;
      state.player.bulletDamage = Math.round(state.player.bulletDamage * 1.25);
    },
  },
]);

export class AugmentationDraftSystem {
  constructor() {
    this.installedAugmentTitles = [];
    this.currentChoices = [];
  }

  /**
   * 随机抽取 3 张不重复的战术强化卡供玩家在波次间隙选择
   */
  generateDraftChoices(seedOffset = 0) {
    const pool = [...ROLLABLE_AUGMENT_CARDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor((Math.sin(i * 17.3 + seedOffset) * 0.5 + 0.5) * (i + 1)) % (i + 1);
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    this.currentChoices = pool.slice(0, 3);
    return this.currentChoices;
  }

  /**
   * 应用玩家选中的强化模块并记录至已安装列表
   */
  applySelectedAugmentation(choiceIndex, engineState) {
    const card = this.currentChoices[choiceIndex] || this.currentChoices[0];
    if (!card) return null;
    card.applyEffect(engineState);
    this.installedAugmentTitles.push(card.title);
    return card;
  }
}
