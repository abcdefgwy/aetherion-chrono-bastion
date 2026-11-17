import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/**
 * make.fun best-game-01 打包入口脚本
 * 负责将 game/ 与 screenshots/ 复制到输出目录并生成符合规范的 dossier.json
 */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
} as const;

/**
 * 确定性地递归复制目录内容（按码点字典序遍历）
 * @param srcDir 源目录绝对路径
 * @param destDir 目标目录绝对路径
 */
function copyDirRecursive(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of entries) {
    const srcPath = join(srcDir, name);
    const destPath = join(destDir, name);
    const info = statSync(srcPath);
    if (info.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (info.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

function main(): void {
  const rootDir = fileURLToPath(new URL('.', import.meta.url));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
  const gameSrc = join(rootDir, 'game');
  const shotsSrc = join(rootDir, 'screenshots');

  const gameOut = join(outDir, 'game');
  const shotsOut = join(outDir, 'screenshots');

  mkdirSync(outDir, { recursive: true });

  copyDirRecursive(gameSrc, gameOut);
  if (existsSync(shotsSrc)) {
    copyDirRecursive(shotsSrc, shotsOut);
  } else {
    mkdirSync(shotsOut, { recursive: true });
  }

  const dossierBytes = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
}

main();
