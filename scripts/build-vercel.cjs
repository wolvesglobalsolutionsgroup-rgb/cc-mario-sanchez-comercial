const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
const directories = ['assets', 'css', 'data', 'gestion', 'js', 'levantamiento'];
const rootFiles = [
  'index.html', 'alquiler.html', 'manifest.json', 'service-worker.js',
  'favicon.ico', 'favicon.png', 'favicon_2k.ico', 'favicon_2k.png',
  'apple-touch-icon.png', 'apple-touch-icon_2k.png',
  'logo_cc_mario_sanchez.png', 'logo_cc_mario_sanchez.svg', 'logo_cc_mario_sanchez_2k.png',
  'logo_cc_mario_sanchez_2k.svg', 'logo_cc_mario_sanchez_rounded.png',
  'logo_cc_mario_sanchez_opt.webp', 'logo_cc_mario_sanchez_transparent.png',
  'puerto_la_cruz_drone.jpg', 'puerto_la_cruz_drone.webp',
  'puerto_la_cruz_drone_mobile.jpg', 'puerto_la_cruz_drone_mobile.webp',
  'puerto_la_cruz_drone_mobile_opt.webp'
];

if (path.basename(output) !== 'public' || path.dirname(output) !== root) {
  throw new Error('BUILD_OUTPUT_PATH_INVALID');
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const directory of directories) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, directory), { recursive: true });
}

for (const file of rootFiles) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(output, file));
}

console.log(`[VERCEL BUILD] Static output ready: ${output}`);
