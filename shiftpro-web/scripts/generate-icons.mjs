import sharp from 'sharp';

// SVG source: white "S" on dark navy background with rounded corners
const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" ry="80" fill="#0f172a"/>
  <text
    x="50%"
    y="62%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700"
    font-size="320"
    fill="#ffffff"
  >S</text>
</svg>
`);

const icons = [
  { file: 'public/pwa-192x192.png',      size: 192 },
  { file: 'public/pwa-512x512.png',      size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon.ico',          size: 32  },
];

for (const { file, size } of icons) {
  await sharp(svg).resize(size, size).png().toFile(file);
  console.log(`✓ ${file}`);
}
