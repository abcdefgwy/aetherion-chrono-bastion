/**
 * AETHERION: CHRONO-BASTION — 程序化 Web Audio API 合成器与动态配乐模块
 * 零外部音频文件依赖，纯靠振荡器、滤波器和包络发生器合成全套激光、爆炸、时停力场与合成波背景配乐。
 */

export class ProceduralAudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.musicStepIndex = 0;
    this.musicTimerAcc = 0;
  }

  /**
   * 惰性初始化浏览器 AudioContext（在首次用户交互时唤醒）
   */
  ensureAudioContextReady() {
    if (this.isMuted) return null;
    if (!this.audioCtx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) {
        this.audioCtx = new AudioContextCtor();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * 切换全局静音开关并返回当前状态描述
   */
  toggleAudioMuteState() {
    this.isMuted = !this.isMuted;
    return !this.isMuted;
  }

  /**
   * 播放主武器等离子炮或穿甲光束射击音效
   */
  playWeaponFireSfx(chassisId = 'valkyrie') {
    const ctx = this.ensureAudioContextReady();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = chassisId === 'chronos' ? 'sawtooth' : 'triangle';
    const startFreq = chassisId === 'aegis' ? 320 : chassisId === 'chronos' ? 780 : 540;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.085);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  /**
   * 播放敌舰解体或重型范围爆炸音效
   */
  playExplosionSfx(intensity = 1.0) {
    const ctx = this.ensureAudioContextReady();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = Math.min(0.45, 0.16 * intensity);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + duration);

    gain.gain.setValueAtTime(Math.min(0.16, 0.09 * intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /**
   * 播放时空裂隙力场（Chrono-Rift）展开音效
   */
  playTimeDilationSfx() {
    const ctx = this.ensureAudioContextReady();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.38);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  /**
   * 播放轨道离子光矛（Orbital Lance）轰击音效
   */
  playOrbitalLanceSfx() {
    const ctx = this.ensureAudioContextReady();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.32);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * 播放哨塔部署或波次升级模块选取琶音
   */
  playAugmentSelectSfx() {
    const ctx = this.ensureAudioContextReady();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /**
   * 驱动战斗中的轻量级低音合成波律动步进器
   */
  updateDynamicMusicSequencer(dtSeconds, isCombatActive) {
    if (!isCombatActive || this.isMuted || !this.audioCtx) return;
    this.musicTimerAcc += dtSeconds;
    if (this.musicTimerAcc < 0.28) return;
    this.musicTimerAcc = 0;

    const bassLine = [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 130.81];
    const freq = bassLine[this.musicStepIndex % bassLine.length];
    this.musicStepIndex += 1;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }
}
