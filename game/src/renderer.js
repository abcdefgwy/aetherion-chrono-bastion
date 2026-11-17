/**
 * 2D Canvas 战场渲染器模块
 * 负责深空星云、战术网格、六边形以太核心、舰船、炮塔光束、
 * 时空裂隙、粒子冲击波、浮动伤害数字与战术小地图绘制
 */

export class BattlefieldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.initStars(160);
  }

  /** 初始化背景视差星场 */
  initStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * 2400,
        y: Math.random() * 1700,
        r: 0.7 + Math.random() * 1.9,
        alpha: 0.25 + Math.random() * 0.65,
        twinkle: Math.random() * Math.PI * 2,
        tint: i % 5 === 0 ? '#7df9ff' : i % 7 === 0 ? '#d8b4fe' : '#ffffff'
      });
    }
  }

  /** 绘制正多边形辅助方法 */
  drawPolygon(ctx, x, y, radius, sides, rotation = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rotation + (Math.PI * 2 * i) / sides;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /** 主渲染入口 */
  render(engine, timeSec) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. 深空星云底色
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      40,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.85
    );
    bgGrad.addColorStop(0, '#0d1730');
    bgGrad.addColorStop(0.55, '#070c1b');
    bgGrad.addColorStop(1, '#03050c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 摄像机偏移与轻微震动
    const shakeX = engine.screenShake > 0 ? (Math.random() - 0.5) * engine.screenShake * 14 : 0;
    const shakeY = engine.screenShake > 0 ? (Math.random() - 0.5) * engine.screenShake * 14 : 0;
    const camX = engine.camera.x + shakeX;
    const camY = engine.camera.y + shakeY;

    // 2. 视差星云与星点
    this.renderBackdrop(ctx, camX, camY, width, height, timeSec);

    // 进入世界坐标系
    ctx.save();
    ctx.translate(-camX, -camY);

    // 3. 战术网格与防御圈
    this.renderTacticalGrid(ctx, engine.worldWidth, engine.worldHeight, engine.core);

    // 4. 时空裂隙场
    for (const rift of engine.rifts) {
      this.renderChronoRift(ctx, rift);
    }

    // 5. 地面冲击波
    for (const sw of engine.shockwaves) {
      const progress = 1 - sw.life / sw.duration;
      const r = sw.radius + (sw.maxRadius - sw.radius) * progress;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (sw.life / sw.duration) * 0.8);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 6. 中央六边形 Aether Core
    this.renderAetherCore(ctx, engine.core, timeSec);

    // 7. 炮塔与激光/电弧波束
    for (const turret of engine.turrets) {
      this.renderTurret(ctx, turret, engine.turretRangeMult);
    }

    // 8. 时空碎片掉落物
    for (const shard of engine.shardsOnGround) {
      this.renderShard(ctx, shard, timeSec);
    }

    // 9. 轨道长矛光束
    for (const beam of engine.orbitalBeams) {
      this.renderOrbitalBeam(ctx, beam);
    }

    // 10. 敌军与 Boss
    for (const enemy of engine.enemies) {
      if (enemy.type === 'leviathan') {
        this.renderLeviathan(ctx, enemy, timeSec);
      } else {
        this.renderEnemy(ctx, enemy);
      }
    }

    // 11. 玩家截击机
    if (engine.player) {
      this.renderPlayer(ctx, engine.player, timeSec);
    }

    // 12. 弹丸
    for (const p of engine.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 13. 粒子特效
    for (const pt of engine.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 14. 浮动战斗数字
    ctx.save();
    ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    for (const ft of engine.floatingTexts) {
      ctx.globalAlpha = Math.min(1, ft.life / ft.maxLife + 0.15);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();

    ctx.restore(); // 退出世界坐标系

    // 15. 右下角战术小地图（仅在战斗或暂停/选卡背景可见）
    if (engine.core && engine.player) {
      this.renderMinimap(ctx, engine, width, height);
    }

    ctx.restore();
  }

  /** 绘制星云光晕与闪烁星点 */
  renderBackdrop(ctx, camX, camY, width, height, timeSec) {
    ctx.save();
    // 柔和星云团
    const neb1X = width * 0.28 - camX * 0.08;
    const neb1Y = height * 0.32 - camY * 0.08;
    const g1 = ctx.createRadialGradient(neb1X, neb1Y, 10, neb1X, neb1Y, 340);
    g1.addColorStop(0, 'rgba(46, 242, 255, 0.09)');
    g1.addColorStop(1, 'rgba(46, 242, 255, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);

    const neb2X = width * 0.74 - camX * 0.06;
    const neb2Y = height * 0.65 - camY * 0.06;
    const g2 = ctx.createRadialGradient(neb2X, neb2Y, 10, neb2X, neb2Y, 380);
    g2.addColorStop(0, 'rgba(185, 117, 255, 0.11)');
    g2.addColorStop(1, 'rgba(185, 117, 255, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);

    for (const star of this.stars) {
      const sx = ((star.x - camX * 0.25) % width + width) % width;
      const sy = ((star.y - camY * 0.25) % height + height) % height;
      const pulse = 0.65 + 0.35 * Math.sin(timeSec * 2 + star.twinkle);
      ctx.globalAlpha = star.alpha * pulse;
      ctx.fillStyle = star.tint;
      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 绘制战场战术网格与边境线 */
  renderTacticalGrid(ctx, worldW, worldH, core) {
    ctx.save();
    const step = 110;
    ctx.strokeStyle = 'rgba(46, 242, 255, 0.065)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= worldW; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, worldH);
    }
    for (let y = 0; y <= worldH; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(worldW, y);
    }
    ctx.stroke();

    // 战场外边界霓虹框
    ctx.strokeStyle = 'rgba(255, 77, 109, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, worldW - 24, worldH - 24);

    // 核心周围防御圈标尺
    if (core) {
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = 'rgba(46, 242, 255, 0.16)';
      ctx.lineWidth = 1.5;
      for (const r of [190, 340]) {
        ctx.beginPath();
        ctx.arc(core.x, core.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /** 绘制六边形 Aether Core */
  renderAetherCore(ctx, core, timeSec) {
    ctx.save();
    const hpRatio = core.hp / core.maxHp;
    const baseColor = core.hitFlash > 0 ? '#ff4d6d' : '#2ef2ff';

    // 外部能量光环
    const glow = ctx.createRadialGradient(core.x, core.y, 12, core.x, core.y, 92);
    glow.addColorStop(0, 'rgba(46, 242, 255, 0.35)');
    glow.addColorStop(1, 'rgba(46, 242, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(core.x, core.y, 92, 0, Math.PI * 2);
    ctx.fill();

    // 外六边形旋转装甲
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(11, 24, 48, 0.88)';
    this.drawPolygon(ctx, core.x, core.y, core.radius, 6, timeSec * 0.35);
    ctx.fill();
    ctx.stroke();

    // 内六边形共振核
    ctx.strokeStyle = '#b975ff';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(185, 117, 255, 0.28)';
    this.drawPolygon(ctx, core.x, core.y, core.radius * 0.56, 6, -timeSec * 0.7);
    ctx.fill();
    ctx.stroke();

    // 核心光球
    const pulseR = 11 + Math.sin(core.pulsePhase) * 2.5;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#2ef2ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(core.x, core.y, pulseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 环形耐久度弧
    ctx.strokeStyle = hpRatio > 0.4 ? '#34e89e' : '#ff4d6d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      core.x,
      core.y,
      core.radius + 14,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * hpRatio
    );
    ctx.stroke();
    ctx.restore();
  }

  /** 绘制 Chrono-Rift 时空裂隙 */
  renderChronoRift(ctx, rift) {
    ctx.save();
    const fade = Math.min(1, rift.duration / 0.8);
    ctx.globalAlpha = fade;

    const grad = ctx.createRadialGradient(rift.x, rift.y, 8, rift.x, rift.y, rift.radius);
    grad.addColorStop(0, 'rgba(185, 117, 255, 0.42)');
    grad.addColorStop(0.65, 'rgba(46, 242, 255, 0.14)');
    grad.addColorStop(1, 'rgba(46, 242, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rift.x, rift.y, rift.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(185, 117, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(rift.x, rift.y, rift.radius * 0.92, rift.spin, rift.spin + Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(46, 242, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(rift.x, rift.y, rift.radius * 0.54, -rift.spin * 1.4, -rift.spin * 1.4 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** 绘制哨戒炮塔与激光/电弧 */
  renderTurret(ctx, turret, rangeMult) {
    ctx.save();
    const effectiveRange = turret.blueprint.range * rangeMult;

    // 射程淡淡提示圈
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(turret.x, turret.y, effectiveRange, 0, Math.PI * 2);
    ctx.stroke();

    // 激光 / 电弧波束
    if (turret.beamFlash > 0 && turret.beamTargets.length > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, turret.beamFlash * 6);
      ctx.strokeStyle = turret.color;
      ctx.shadowColor = turret.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = turret.id === 'tesla' ? 2.6 : 2.2;

      for (const tgt of turret.beamTargets) {
        ctx.beginPath();
        ctx.moveTo(turret.x, turret.y);
        if (turret.id === 'tesla') {
          const mx = (turret.x + tgt.x) * 0.5 + (Math.random() - 0.5) * 26;
          const my = (turret.y + tgt.y) * 0.5 + (Math.random() - 0.5) * 26;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 炮塔底座
    ctx.fillStyle = '#0d192f';
    ctx.strokeStyle = turret.color;
    ctx.lineWidth = 2.2;
    this.drawPolygon(ctx, turret.x, turret.y, turret.radius, turret.id === 'aegis' ? 4 : 6, Math.PI / 4);
    ctx.fill();
    ctx.stroke();

    // 炮管方向
    ctx.save();
    ctx.translate(turret.x, turret.y);
    ctx.rotate(turret.angle);
    ctx.fillStyle = turret.color;
    ctx.fillRect(0, -3, 18, 6);
    ctx.restore();

    // 血条
    if (turret.hp < turret.maxHp) {
      const w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(turret.x - w / 2, turret.y + 24, w, 4);
      ctx.fillStyle = turret.color;
      ctx.fillRect(turret.x - w / 2, turret.y + 24, w * (turret.hp / turret.maxHp), 4);
    }
    ctx.restore();
  }

  /** 绘制时空碎片 */
  renderShard(ctx, shard, timeSec) {
    ctx.save();
    const bob = Math.sin(timeSec * 5 + shard.bobPhase) * 2.5;
    ctx.translate(shard.x, shard.y + bob);
    ctx.rotate(timeSec * 2.2 + shard.bobPhase);
    ctx.fillStyle = '#5ef2ff';
    ctx.shadowColor = '#2ef2ff';
    ctx.shadowBlur = 10;
    this.drawPolygon(ctx, 0, 0, shard.radius, 4, 0);
    ctx.fill();
    ctx.restore();
  }

  /** 绘制轨道长矛光束 */
  renderOrbitalBeam(ctx, beam) {
    ctx.save();
    const alpha = Math.max(0, beam.life / beam.maxLife);
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';

    ctx.strokeStyle = beam.color;
    ctx.shadowColor = beam.color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 24 * alpha;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7 * alpha;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();
    ctx.restore();
  }

  /** 绘制玩家截击机 */
  renderPlayer(ctx, player, timeSec) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // 引擎推进尾焰
    const flameLen = 14 + Math.sin(timeSec * 40) * 4 + (player.dashActive > 0 ? 18 : 0);
    ctx.fillStyle = player.dashActive > 0 ? '#ffffff' : player.shipClass.color;
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-14 - flameLen, 0);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();

    // 机身主轮廓
    const bodyColor = player.hitFlash > 0 ? '#ffffff' : player.shipClass.color;
    ctx.fillStyle = '#0b1830';
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 2.6;
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    if (player.shipClass.id === 'aegis') {
      // 重装宽翼盾型
      ctx.moveTo(22, 0);
      ctx.lineTo(6, 17);
      ctx.lineTo(-16, 15);
      ctx.lineTo(-11, 0);
      ctx.lineTo(-16, -15);
      ctx.lineTo(6, -17);
    } else if (player.shipClass.id === 'chronos') {
      // 前掠双尖翼
      ctx.moveTo(24, 0);
      ctx.lineTo(-4, 18);
      ctx.lineTo(-16, 7);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-16, -7);
      ctx.lineTo(-4, -18);
    } else {
      // Valkyrie 锐利三角箭矢
      ctx.moveTo(23, 0);
      ctx.lineTo(-14, 15);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, -15);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 驾驶舱亮点
    ctx.fillStyle = player.shipClass.accent;
    ctx.beginPath();
    ctx.arc(4, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 绘制普通敌军 */
  renderEnemy(ctx, enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);

    const col = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
    ctx.fillStyle = '#1b0d1f';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.2;

    if (enemy.type === 'swarmer') {
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 3, 0);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.85);
      ctx.lineTo(-enemy.radius * 0.45, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (enemy.type === 'lancer') {
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 5, 0);
      ctx.lineTo(0, enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius, 0);
      ctx.lineTo(0, -enemy.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      this.drawPolygon(ctx, 0, 0, enemy.radius, 6, 0);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // 受伤敌军显示小型血条
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 1.9;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 10, w, 4);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 10, w * (enemy.hp / enemy.maxHp), 4);
    }
  }

  /** 绘制 Wave 5 Void Leviathan Boss */
  renderLeviathan(ctx, boss, timeSec) {
    ctx.save();
    ctx.translate(boss.x, boss.y);

    // 阶段能量外环
    ctx.strokeStyle = boss.phase === 3 ? '#ff4d6d' : '#b975ff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, boss.radius + 18, timeSec * 1.1, timeSec * 1.1 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(boss.angle);
    const col = boss.hitFlash > 0 ? '#ffffff' : boss.color;
    ctx.fillStyle = '#1f0726';
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;

    this.drawPolygon(ctx, 0, 0, boss.radius, 8, Math.PI / 8);
    ctx.fill();
    ctx.stroke();

    // 内部核心眼
    ctx.fillStyle = '#ff9248';
    this.drawPolygon(ctx, 8, 0, 20, 4, timeSec * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 绘制右下角战术小地图 */
  renderMinimap(ctx, engine, viewW, viewH) {
    const mapW = 166;
    const mapH = 114;
    const pad = 16;
    const x0 = viewW - mapW - pad;
    const y0 = viewH - mapH - pad;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 11, 24, 0.78)';
    ctx.strokeStyle = 'rgba(46, 242, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x0, y0, mapW, mapH);
    ctx.strokeRect(x0, y0, mapW, mapH);

    const sx = mapW / engine.worldWidth;
    const sy = mapH / engine.worldHeight;

    // 核心
    ctx.fillStyle = '#2ef2ff';
    ctx.beginPath();
    ctx.arc(x0 + engine.core.x * sx, y0 + engine.core.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();

    // 炮塔
    ctx.fillStyle = '#ffb84d';
    for (const t of engine.turrets) {
      ctx.fillRect(x0 + t.x * sx - 1.5, y0 + t.y * sy - 1.5, 3, 3);
    }

    // 敌军
    for (const e of engine.enemies) {
      ctx.fillStyle = e.type === 'leviathan' ? '#ff2e93' : '#ff4d6d';
      const r = e.type === 'leviathan' ? 4.5 : 2;
      ctx.beginPath();
      ctx.arc(x0 + e.x * sx, y0 + e.y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x0 + engine.player.x * sx, y0 + engine.player.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
