/**
 * 舰船职业、炮塔蓝图与 Roguelite 强化卡牌配置模块
 */

/** 3 种可选截击机职业定义 */
export const SHIP_CLASSES = {
  valkyrie: {
    id: 'valkyrie',
    name: 'Valkyrie-IX',
    role: '高速突击截击机',
    badge: 'STRIKER',
    color: '#2ef2ff',
    accent: '#8cf8ff',
    maxHull: 110,
    speed: 330,
    fireRate: 0.125,
    damage: 20,
    projectileSpeed: 880,
    spread: 0.04,
    multishot: 1,
    pierce: 0,
    maxEnergy: 100,
    energyRegen: 14,
    dashCooldown: 2.2,
    summary: '极高航速与射速，擅长游走清场与快速拾取时空碎片。'
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis-VII',
    role: '重装堡垒护卫舰',
    badge: 'BASTION',
    color: '#ffb84d',
    accent: '#ffe0a3',
    maxHull: 170,
    speed: 255,
    fireRate: 0.24,
    damage: 17,
    projectileSpeed: 760,
    spread: 0.18,
    multishot: 3,
    pierce: 0,
    maxEnergy: 110,
    energyRegen: 12,
    dashCooldown: 2.8,
    summary: '高装甲与三联装散射炮，正面压制重甲敌群与贴身护航核心。'
  },
  chronos: {
    id: 'chronos',
    name: 'Chronos-IV',
    role: '时空裂隙先驱舰',
    badge: 'ARCANIST',
    color: '#b975ff',
    accent: '#e2c2ff',
    maxHull: 125,
    speed: 295,
    fireRate: 0.21,
    damage: 34,
    projectileSpeed: 980,
    spread: 0.015,
    multishot: 1,
    pierce: 2,
    maxEnergy: 140,
    energyRegen: 18,
    dashCooldown: 1.9,
    summary: '高能穿透光束与充沛时空能量，高频释放裂隙与轨道长矛。'
  }
};

/** 3 种可部署哨戒炮塔蓝图 */
export const TURRET_BLUEPRINTS = {
  pulse: {
    id: 'pulse',
    hotkey: '1',
    name: 'Pulse Sentinel',
    shortName: 'PULSE',
    cost: 25,
    color: '#2ef2ff',
    range: 340,
    fireRate: 0.28,
    damage: 16,
    maxHp: 130,
    description: '高速脉冲激光炮塔，稳定点杀靠近核心的蜂群。'
  },
  aegis: {
    id: 'aegis',
    hotkey: '2',
    name: 'Aegis Pylon',
    shortName: 'AEGIS',
    cost: 35,
    color: '#ffb84d',
    range: 240,
    fireRate: 1.1,
    damage: 18,
    maxHp: 240,
    healRate: 4.5,
    description: '重甲力场塔，缓慢修复周边核心与炮塔并释放震荡波。'
  },
  tesla: {
    id: 'tesla',
    hotkey: '3',
    name: 'Tesla Arc Coil',
    shortName: 'TESLA',
    cost: 45,
    color: '#b975ff',
    range: 300,
    fireRate: 0.72,
    damage: 34,
    chainCount: 3,
    maxHp: 150,
    description: '高能电弧塔，释放链式闪电同时灼烧最多 3 个目标。'
  }
};

/** 6 张波次通关 Roguelite 强化卡牌 */
export const AUGMENT_CARDS = [
  {
    id: 'hyper_capacitor',
    name: '超频电容器',
    tag: 'OFFENSE',
    rarity: 'RARE',
    color: '#2ef2ff',
    description: '主炮射速提升 22%，且子弹飞行速度提升 15%。',
    apply(engine) {
      engine.player.fireRate *= 0.78;
      engine.player.projectileSpeed *= 1.15;
    }
  },
  {
    id: 'prism_splitter',
    name: '棱镜分束矩阵',
    tag: 'BARRAGE',
    rarity: 'EPIC',
    color: '#b975ff',
    description: '主炮额外发射 +1 枚弹丸，单发伤害提升 10%。',
    apply(engine) {
      engine.player.multishot += 1;
      engine.player.spread = Math.max(engine.player.spread, 0.11);
      engine.player.damage = Math.round(engine.player.damage * 1.1);
    }
  },
  {
    id: 'chrono_overclock',
    name: '时空超频核心',
    tag: 'CHRONO',
    rarity: 'RARE',
    color: '#7df9ff',
    description: '能量上限 +35，能量回复 +35%，Q/E 技能冷却缩短 20%。',
    apply(engine) {
      engine.player.maxEnergy += 35;
      engine.player.energy = engine.player.maxEnergy;
      engine.player.energyRegen *= 1.35;
      engine.cooldownScale *= 0.8;
    }
  },
  {
    id: 'bastion_nanites',
    name: '堡垒纳米修复',
    tag: 'DEFENSE',
    rarity: 'COMMON',
    color: '#34e89e',
    description: '立即恢复 45% 战机护甲与 30% Aether Core 耐久，并提升双方上限 +40。',
    apply(engine) {
      engine.player.maxHull += 40;
      engine.player.hull = Math.min(engine.player.maxHull, engine.player.hull + engine.player.maxHull * 0.45);
      engine.core.maxHp += 60;
      engine.core.hp = Math.min(engine.core.maxHp, engine.core.hp + engine.core.maxHp * 0.3);
    }
  },
  {
    id: 'sentinel_overdrive',
    name: '哨戒炮塔增幅',
    tag: 'TURRET',
    rarity: 'RARE',
    color: '#ffb84d',
    description: '所有已部署与新建炮塔伤害 +35%、射程 +18%，并赠送 35 Chrono-Shards。',
    apply(engine) {
      engine.turretDamageMult *= 1.35;
      engine.turretRangeMult *= 1.18;
      engine.shards += 35;
      for (const turret of engine.turrets) {
        turret.hp = Math.min(turret.maxHp, turret.hp + 40);
      }
    }
  },
  {
    id: 'void_piercer',
    name: '虚空穿甲弹芯',
    tag: 'LETHAL',
    rarity: 'EPIC',
    color: '#ff5e8a',
    description: '主炮获得 +1 穿透次数，暴击/直击伤害提升 28%。',
    apply(engine) {
      engine.player.pierce += 1;
      engine.player.damage = Math.round(engine.player.damage * 1.28);
    }
  }
];

/**
 * 从强化池中抽取指定数量的随机卡牌（优先不重复）
 * @param {number} count 抽取数量
 * @param {Set<string>} acquiredIds 已获取卡牌 ID 集合
 * @returns {Array} 抽中的卡牌数组
 */
export function pickDraftCards(count = 3, acquiredIds = new Set()) {
  const unseen = AUGMENT_CARDS.filter((c) => !acquiredIds.has(c.id));
  const pool = unseen.length >= count ? [...unseen] : [...AUGMENT_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
