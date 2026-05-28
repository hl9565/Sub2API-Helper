const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const manifestPath = path.join(rootDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = String(manifest.version || '0.0.0').trim() || '0.0.0';
const archiveName = `Sub2API-Helper-${version}.zip`;
const archivePath = path.join(distDir, archiveName);

const includePaths = [
  'manifest.json',
  'rules.json',
  'background.js',
  'background',
  'content',
  'core',
  'flows',
  'icons',
  'imports',
  'phone-sms',
  'shared',
  'sidepanel',
  'cloudflare-temp-email-utils.js',
  'cloudmail-utils.js',
  'gopay-utils.js',
  'hotmail-utils.js',
  'icloud-utils.js',
  'luckmail-utils.js',
  'mail-provider-utils.js',
  'mail2925-utils.js',
  'managed-alias-utils.js',
  'microsoft-email.js',
  'paypal-utils.js',
  'yyds-mail-utils.js',
];

const excludePatterns = [
  '*.DS_Store',
  '__MACOSX/*',
  'data/*',
  'tests/*',
  'docs/*',
  'md/*',
  '.git/*',
  '.github/*',
  'node_modules/*',
  'dist/*',
  '*.zip',
  '*.crx',
  '*.pem',
  'config.json',
];

fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(archivePath)) {
  fs.rmSync(archivePath);
}

const existingIncludePaths = includePaths.filter((entry) => fs.existsSync(path.join(rootDir, entry)));
const args = [
  '-r',
  archivePath,
  ...existingIncludePaths,
  '-x',
  ...excludePatterns,
];

const result = spawnSync('zip', args, {
  cwd: rootDir,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`打包失败：${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`打包失败：zip 退出码 ${result.status}`);
  process.exit(result.status || 1);
}

console.log(`打包完成：${path.relative(rootDir, archivePath)}`);
