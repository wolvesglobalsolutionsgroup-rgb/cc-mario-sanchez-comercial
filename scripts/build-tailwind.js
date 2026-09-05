const fs = require('fs');
const { execSync } = require('child_process');

fs.writeFileSync('css/input.css', @import "tailwindcss";
@theme {
  --color-brand-void: #04070d;
  --color-brand-surface: #080d17;
  --color-brand-card: #0e1626;
  --color-brand-amber: #f59e0b;
  --color-brand-amberLight: #fbbf24;
  --color-brand-cyan: #0ea5e9;
  --color-brand-cyanLight: #38bdf8;
  --color-brand-emerald: #10b981;
  --color-brand-emeraldLight: #34d399;
  --color-brand-rose: #f43f5e;
  --font-heading: Outfit, sans-serif;
  --font-body: Manrope, sans-serif;
}
);

execSync('npx @tailwindcss/cli -i css/input.css -o css/tailwind-built.min.css --minify', { stdio: 'inherit' });
console.log('Tailwind compiled successfully!');
