/**
 * AETHERION: CHRONO-BASTION — 参赛交付入口脚本 (main.ts)
 * 负责将离线网页游戏目录 game/ 与实机运行截图目录 screenshots/ 复制至目标输出目录，
 * 并调用官方 vendor/makefun-game.ts 中的 buildDossier 生成字节级一致的 dossier.json。
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/**
 * 解析当前仓库根目录路径与评测输出目录路径，并校验评测约束参数
 */
const DOSSIER_EXPORT_LIMITS = Object.freeze({
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

function resolveExportDirectories(): { repoRootDir: string; targetOutputDir: string } {
  const repoRootDir = fileURLToPath(new URL('.', import.meta.url));
  const targetOutputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  return { repoRootDir, targetOutputDir };
}

/**
 * 同步拷贝游戏静态资源与实机截图并生成 dossier.json
 */
function exportGameSubmissionArtifact(): void {
  const { repoRootDir, targetOutputDir } = resolveExportDirectories();

  mkdirSync(targetOutputDir, { recursive: true });
  cpSync(join(repoRootDir, 'game'), join(targetOutputDir, 'game'), { recursive: true });

  const targetScreenshotsDir = join(targetOutputDir, 'screenshots');
  mkdirSync(targetScreenshotsDir, { recursive: true });

  const sourceScreenshotsDir = join(repoRootDir, 'screenshots');
  if (existsSync(sourceScreenshotsDir)) {
    cpSync(sourceScreenshotsDir, targetScreenshotsDir, { recursive: true });
  }

  const dossierPayloadBytes = buildDossier(targetOutputDir, DOSSIER_EXPORT_LIMITS);
  writeFileSync(join(targetOutputDir, 'dossier.json'), dossierPayloadBytes);
}

exportGameSubmissionArtifact();
