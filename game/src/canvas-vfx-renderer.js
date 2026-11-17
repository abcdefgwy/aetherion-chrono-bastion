/**
 * AETHERION: CHRONO-BASTION — 高对比度科幻战术 Canvas 渲染引擎与粒子特效系统
 */

export class ParticleVfxSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  spawnParticleBurst(x, y, color, count = 14, speedScale = 1.0) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = (45 + Math.random() * 165) * speedScale;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3.2,
        color,
        alpha: 1,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
      });
    }
  }

  spawnShockwaveRing(x, y, maxRadius, color) {
    this.shockwaves.push({
      x,
      y,
      radius: 12,
      maxRadius,
      color,
      life: 0.42,
      maxLife: 0.42,
    });
  }

  spawnFloatingText(x, y, text, color = '#00f2fe') {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0.85,
      maxLife: 0.85,
    });
  }

  updateVfxFrame(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      const progress = 1 - Math.max(0, s.life / s.maxLife);
      s.radius = 12 + (s.maxRadius - 12) * progress;
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 32 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }
}

export class BattlefieldCanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    for (let i = 0; i < 95; i++) {
      this.stars.push({
        x: (i * 197) % 1280,
        y: (i * 313) % 720,
        size: (i % 3) + 1,
        alpha: 0.25 + (i % 5) * 0.14,
      });
    }
  }

  /**
   * 渲染深空星云背景、战术网格与防御圈边界
   */
  renderParallaxNebulaAndGrid(ctx, width, height, timeSec) {
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.68);
    grad.addColorStop(0, '#0c1c3e');
    grad.addColorStop(0.55, '#071024');
    grad.addColorStop(1, '#030611');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 战术经纬网格
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.065)';
    ctx.lineWidth = 1;
    const step = 64;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 闪烁星群
    for (const st of this.stars) {
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * 2.2 + st.x);
      ctx.fillStyle = `rgba(190, 230, 255, ${st.alpha * pulse})`;
      ctx.fillRect(st.x, st.y, st.size, st.size);
    }

    // 中央堡垒战术防御环
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.18)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 175, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 178, 36, 0.14)';
    ctx.beginPath();
    ctx.arc(0, 0, 285, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 渲染整帧战场场景：时停力场、核心、哨塔、玩家、敌群、Boss、弹幕、特效与雷达
   */
  renderBattlefieldFrame(state) {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    this.renderParallaxNebulaAndGrid(ctx, width, height, state.elapsedTime);

    // 1. 渲染 Chrono-Rift 时停力场区域
    for (const rift of state.rifts) {
      ctx.save();
      const rGrad = ctx.createRadialGradient(rift.x, rift.y, 10, rift.x, rift.y, rift.radius);
      rGrad.addColorStop(0, 'rgba(196, 113, 237, 0.32)');
      rGrad.addColorStop(0.75, 'rgba(0, 242, 254, 0.16)');
      rGrad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(rift.x, rift.y, rift.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(rift.x, rift.y, rift.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 渲染中央以太核心 (Aether Core)
    this.renderAetherCoreEntity(ctx, state.core, state.elapsedTime);

    // 3. 渲染自动哨塔与激光束
    for (const turret of state.turrets) {
      this.renderTurretEntity(ctx, turret);
    }

    // 4. 渲染掉落的 Chrono-Shards 晶体
    for (const shard of state.shardPickups) {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(state.elapsedTime * 3 + shard.pulse);
      ctx.fillStyle = '#00f2fe';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. 渲染敌方舰队与血条
    for (const enemy of state.enemies) {
      this.renderEnemyEntity(ctx, enemy);
    }

    // 6. 渲染虚空利维坦 Boss
    if (state.boss) {
      this.renderLeviathanBossEntity(ctx, state.boss, state.elapsedTime);
    }

    // 7. 渲染玩家战机与瞄准线
    this.renderPlayerShipEntity(ctx, state.player, state.mousePos);

    // 8. 渲染所有弹幕与能量束
    for (const proj of state.projectiles) {
      ctx.save();
      ctx.fillStyle = proj.color;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. 渲染粒子、冲击波环与浮动战斗数值
    this.renderVfxOverlays(ctx, state.vfx);

    // 10. 渲染左下角战术雷达小地图
    this.renderTacticalMinimap(ctx, state, 24, height - 178, 128, 92);
  }

  renderAetherCoreEntity(ctx, core, timeSec) {
    ctx.save();
    ctx.translate(core.x, core.y);

    // 外层六边形能量护盾
    ctx.rotate(timeSec * 0.45);
    ctx.strokeStyle = core.hitFlashTimer > 0 ? '#ff2a85' : '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const rx = Math.cos(a) * core.radius;
      const ry = Math.sin(a) * core.radius;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 242, 254, 0.14)';
    ctx.fill();
    ctx.stroke();

    // 内核发光反应堆
    ctx.beginPath();
    ctx.arc(0, 0, 20 + Math.sin(timeSec * 5) * 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb224';
    ctx.shadowColor = '#ffb224';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();
  }

  renderTurretEntity(ctx, turret) {
    if (turret.laserBeamTimer > 0) {
      ctx.save();
      ctx.strokeStyle = turret.color;
      ctx.lineWidth = 2.6;
      ctx.shadowColor = turret.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(turret.x, turret.y);
      ctx.lineTo(turret.lastTargetX, turret.lastTargetY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(turret.x, turret.y);
    ctx.fillStyle = '#0d1b3a';
    ctx.strokeStyle = turret.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.rotate(turret.aimAngle);
    ctx.fillStyle = turret.color;
    ctx.fillRect(0, -3, 16, 6);
    ctx.restore();
  }

  renderPlayerShipEntity(ctx, player, mousePos) {
    ctx.save();
    // 激光瞄准引导线
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.22)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(mousePos.x, mousePos.y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aimAngle);

    if (player.invulnerableTimer > 0) {
      ctx.strokeStyle = '#10f59c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = player.primaryColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = player.primaryColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -15);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  renderEnemyEntity(ctx, enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const angle = Math.atan2(enemy.vy, enemy.vx);
    ctx.rotate(angle);

    ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
    ctx.strokeStyle = '#ffe5f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (enemy.archetype === 'crusher') {
      ctx.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    } else {
      ctx.moveTo(enemy.radius, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.85);
      ctx.lineTo(-enemy.radius * 0.5, 0);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.85);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 敌舰顶部微型血条
    if (enemy.hp < enemy.maxHp) {
      const bw = 28;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(enemy.x - bw / 2, enemy.y - enemy.radius - 10, bw, 4);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - bw / 2, enemy.y - enemy.radius - 10, bw * (enemy.hp / enemy.maxHp), 4);
    }
  }

  renderLeviathanBossEntity(ctx, boss, timeSec) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(Math.sin(timeSec * 1.2) * 0.25);

    ctx.fillStyle = boss.hitFlash > 0 ? '#ffffff' : '#ff1e56';
    ctx.strokeStyle = '#ffb224';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff2a85';
    ctx.shadowBlur = 24;

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? boss.radius : boss.radius * 0.68;
      const a = (i * Math.PI) / 4;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#070b19';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderVfxOverlays(ctx, vfx) {
    for (const sw of vfx.shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.life / sw.maxLife);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of vfx.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const ft of vfx.floatingTexts) {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = Math.min(1, ft.life / ft.maxLife);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  renderTacticalMinimap(ctx, state, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 14, 32, 0.85)';
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    const sx = w / this.canvas.width;
    const sy = h / this.canvas.height;

    // 核心点
    ctx.fillStyle = '#ffb224';
    ctx.fillRect(x + state.core.x * sx - 3, y + state.core.y * sy - 3, 6, 6);

    // 哨塔点
    ctx.fillStyle = '#10f59c';
    for (const t of state.turrets) {
      ctx.fillRect(x + t.x * sx - 2, y + t.y * sy - 2, 4, 4);
    }

    // 敌群点
    ctx.fillStyle = '#ff2a85';
    for (const e of state.enemies) {
      ctx.fillRect(x + e.x * sx - 1.5, y + e.y * sy - 1.5, 3, 3);
    }

    // 玩家点
    ctx.fillStyle = '#00f2fe';
    ctx.fillRect(x + state.player.x * sx - 2.5, y + state.player.y * sy - 2.5, 5, 5);
    ctx.restore();
  }
}
