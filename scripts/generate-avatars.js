// Generates 50 soft-shaded illustrated avatars with natural proportions (own drawing, no third-party art).
const fs = require('fs');
const out = process.argv[2];
const count = Number(process.argv[3] || 50);

let seed = 20261127;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

const SKIN = ['#fbd9c4', '#f3c6a5', '#eab38c', '#d99a6c', '#c27e52', '#9c5f3b', '#7a4527', '#5a3220'];
const HAIR = ['#2a1a12', '#4b2a19', '#6e3b20', '#8c4a22', '#a5602c', '#c98a3f', '#e0b35f', '#1b1b1f', '#8f8f94', '#b8442a'];
const EYES = ['#5b3a1e', '#3f6fb5', '#3b8a5a', '#8a6a2f', '#2c5c8a', '#6b4a2a'];
const BG = ['#d7ecf7', '#f7e3d7', '#e6dff7', '#dff3e6', '#f7f0d7', '#f6dde6'];
const JACKET = ['#26324f', '#2f3540', '#5a5f6b', '#6b4a33', '#2f5a4a', '#6a2633', '#3d4f7a', '#8a8f99'];
const SHIRT = ['#ffffff', '#dfe9f5', '#f3eee2', '#f6dfe4', '#e3f0e4'];
const TIE = ['#7a1f2b', '#22355e', '#2d2d33', '#3f6a4a', '#8a5a1f'];
const ACCENT = ['#e0506a', '#f08a3c', '#4aa3d8', '#8a63d2', '#3cb38a', '#e8c13a'];

const HAIRSTYLES = ['quiff', 'side', 'afro', 'long', 'bun', 'buzz', 'curly', 'bob', 'puffs', 'spiky'];

function avatar(i) {
  const style = HAIRSTYLES[i % HAIRSTYLES.length];
  const skin = SKIN[Math.floor(rnd() * SKIN.length)];
  const hair = style === 'afro' || style === 'puffs' || style === 'curly'
    ? pick(HAIR.slice(0, 4).concat(['#1b1b1f']))
    : (rnd() < 0.08 ? '#8f8f94' : pick(HAIR.filter((h) => h !== '#8f8f94')));
  const eye = pick(EYES);
  const bg = pick(BG);
  const soft = ['long', 'bun', 'bob', 'puffs'].includes(style) || (style === 'afro' && rnd() < 0.6) || (style === 'curly' && rnd() < 0.5);
  const jacket = pick(JACKET);
  const shirt = pick(SHIRT);
  const tie = !soft && rnd() < 0.55 ? pick(TIE) : null;
  const beard = !soft && style !== 'spiky' && rnd() < 0.3;
  const glasses = rnd() < 0.18;
  const earrings = soft && rnd() < 0.55;
  const headband = (style === 'afro' || style === 'puffs' || style === 'long') && rnd() < 0.45 ? pick(ACCENT) : null;
  const blouse = soft && rnd() < 0.5;

  const id = `a${i}`;
  const lip = shade(skin, -0.28).replace(/^#(..)/, (m, r) => '#' + Math.min(255, parseInt(r, 16) + 28).toString(16).padStart(2, '0'));
  const skinLight = shade(skin, 0.25);
  const skinDark = shade(skin, -0.22);
  const hairLight = shade(hair, 0.3);
  const hairDark = shade(hair, -0.35);

  const defs = `
  <defs>
    <radialGradient id="${id}bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${shade(bg, 0.5)}"/><stop offset="1" stop-color="${shade(bg, -0.08)}"/></radialGradient>
    <radialGradient id="${id}skin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${skinLight}"/><stop offset=".65" stop-color="${skin}"/><stop offset="1" stop-color="${skinDark}"/></radialGradient>
    <linearGradient id="${id}neck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skinDark}"/><stop offset="1" stop-color="${skin}"/></linearGradient>
    <linearGradient id="${id}hair" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${hairLight}"/><stop offset=".55" stop-color="${hair}"/><stop offset="1" stop-color="${hairDark}"/></linearGradient>
    <linearGradient id="${id}jacket" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(jacket, 0.25)}"/><stop offset="1" stop-color="${shade(jacket, -0.3)}"/></linearGradient>
    <linearGradient id="${id}shirt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shirt}"/><stop offset="1" stop-color="${shade(shirt, -0.15)}"/></linearGradient>
    <radialGradient id="${id}iris" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="${shade(eye, 0.45)}"/><stop offset="1" stop-color="${shade(eye, -0.35)}"/></radialGradient>
    <radialGradient id="${id}blush" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e86a6a" stop-opacity=".18"/><stop offset="1" stop-color="#ff6f7d" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}eyew" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4e8ee"/></radialGradient>
    <clipPath id="${id}c"><circle cx="100" cy="104" r="86"/></clipPath>
    <clipPath id="${id}m"><path d="M82 118 Q100 140 118 118 Q100 124 82 118Z"/></clipPath>
  </defs>`;

  const H = `url(#${id}hair)`;
  let back = '';
  let front = '';
  switch (style) {
    case 'quiff':
      front = `<path fill="${H}" d="M57 92 C50 52 70 30 98 28 C128 26 150 46 144 92 C140 74 132 64 118 60 C104 66 80 62 66 70 C61 76 58 84 57 92Z"/>
        <path fill="${H}" d="M74 44 C80 14 132 8 150 30 C144 26 136 26 128 30 C140 36 146 46 144 58 C130 40 104 40 74 44Z"/>`;
      break;
    case 'side':
      front = `<path fill="${H}" d="M56 94 C48 50 74 28 102 30 C132 30 152 52 144 94 C141 76 136 66 128 60 C112 58 92 50 72 64 C62 72 58 82 56 94Z"/>
        <path fill="${hairDark}" opacity=".35" d="M80 40 C92 46 104 50 126 48 C112 54 96 54 80 40Z"/>`;
      break;
    case 'spiky':
      front = `<path fill="${H}" d="M57 92 C52 60 60 40 70 34 L66 18 L84 28 L90 10 L102 26 L116 8 L120 28 L138 16 L134 34 C146 44 150 66 144 92 C140 74 132 64 118 62 C102 66 80 62 66 70 C61 76 58 84 57 92Z"/>`;
      break;
    case 'buzz':
      front = `<path fill="${H}" opacity=".85" d="M58 86 C56 48 78 34 100 34 C124 34 146 48 142 86 C138 66 124 56 100 56 C78 56 62 66 58 86Z"/>`;
      break;
    case 'afro':
      back = [[100, 46, 44], [62, 60, 26], [138, 60, 26], [56, 88, 20], [144, 88, 20], [78, 32, 24], [122, 32, 24]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${H}"/>`).join('');
      front = `<path fill="${H}" d="M60 82 C62 58 82 48 100 48 C120 48 140 58 140 82 C130 66 116 62 100 62 C84 62 70 66 60 82Z"/>`;
      break;
    case 'puffs':
      back = `<circle cx="58" cy="40" r="24" fill="${H}"/><circle cx="142" cy="40" r="24" fill="${H}"/>`;
      front = `<path fill="${H}" d="M57 90 C54 50 76 34 100 34 C124 34 146 50 143 90 C138 68 122 58 100 58 C78 58 62 68 57 90Z"/>`;
      break;
    case 'curly':
      front = [[66, 66, 14], [72, 50, 15], [86, 40, 15], [102, 36, 16], [118, 40, 15], [132, 50, 15], [136, 66, 14], [94, 52, 12], [112, 54, 12]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${H}"/>`).join('');
      break;
    case 'long':
      back = `<path fill="${H}" d="M50 92 C42 36 158 36 150 92 L158 170 C140 182 60 182 42 170 Z"/>`;
      front = `<path fill="${H}" d="M55 98 C50 50 76 32 102 32 C130 32 150 52 145 98 C138 72 126 60 104 56 C96 70 78 76 62 78 C58 84 56 90 55 98Z"/>`;
      break;
    case 'bob':
      back = `<path fill="${H}" d="M48 96 C42 40 158 40 152 96 L150 132 C140 140 128 136 126 128 L74 128 C72 136 60 140 50 132 Z"/>`;
      front = `<path fill="${H}" d="M54 96 C50 50 76 32 100 32 C126 32 150 50 146 96 C142 76 136 66 128 62 C110 66 90 66 72 62 C64 66 58 78 54 96Z"/>`;
      break;
    case 'bun':
      back = `<circle cx="100" cy="22" r="20" fill="${H}"/>`;
      front = `<path fill="${H}" d="M56 92 C50 50 76 34 100 34 C124 34 150 50 144 92 C140 70 126 60 112 58 C100 64 82 62 70 64 C62 70 58 80 56 92Z"/>`;
      break;
  }
  if (headband) {
    front += `<path fill="none" stroke="${headband}" stroke-width="8" stroke-linecap="round" d="M60 72 C76 50 124 50 140 72"/>
      <path fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round" d="M66 66 C82 50 118 50 134 66"/>`;
  }

  // Body: jacket or blouse, shirt and optional tie.
  let body;
  if (blouse) {
    body = `<path fill="url(#${id}shirt)" d="M24 200 C26 168 48 150 80 146 L120 146 C152 150 174 168 176 200Z"/>
      <path fill="${shade(shirt, -0.12)}" d="M80 146 L100 172 L120 146 L112 144 L100 160 L88 144Z"/>`;
  } else {
    body = `<path fill="url(#${id}jacket)" d="M20 200 C22 166 46 148 80 144 L120 144 C154 148 178 166 180 200Z"/>
      <path fill="url(#${id}shirt)" d="M80 144 L100 190 L120 144Z"/>
      <path fill="${shade(shirt, -0.08)}" d="M80 144 L92 166 L100 150 L108 166 L120 144 L112 140 L100 152 L88 140Z"/>
      ${tie ? `<path fill="${tie}" d="M96 152 L104 152 L107 160 L103 194 L97 194 L93 160Z"/><path fill="${shade(tie, 0.2)}" d="M96 152 L104 152 L102 158 L98 158Z"/>` : ''}
      <path fill="${shade(jacket, -0.35)}" d="M80 144 L94 186 L86 200 L72 158Z" opacity=".55"/>
      <path fill="${shade(jacket, -0.35)}" d="M120 144 L106 186 L114 200 L128 158Z" opacity=".55"/>`;
  }

  const lashes = soft
    ? `<path fill="none" stroke="#1d1410" stroke-width="1.2" stroke-linecap="round" d="M73.5 89 L71.5 87.5 M127.5 89 L129.5 87.5"/>`
    : '';
  const eyeShape = (cx) => `
    <path fill="${skinDark}" opacity=".35" d="M${cx - 11} 91 Q${cx} 81 ${cx + 11} 91 Q${cx} 86 ${cx - 11} 91Z"/>
    <path fill="url(#${id}eyew)" d="M${cx - 9} 92 Q${cx} 85 ${cx + 9} 92 Q${cx} 97.5 ${cx - 9} 92Z"/>
    <clipPath id="${id}e${cx}"><path d="M${cx - 9} 92 Q${cx} 85 ${cx + 9} 92 Q${cx} 97.5 ${cx - 9} 92Z"/></clipPath>
    <g clip-path="url(#${id}e${cx})"><circle cx="${cx}" cy="91.6" r="4.3" fill="url(#${id}iris)"/><circle cx="${cx}" cy="91.6" r="1.9" fill="#120d0b"/><circle cx="${cx + 1.5}" cy="90.2" r="1" fill="#ffffff" opacity=".9"/></g>
    <path fill="none" stroke="#2a1c16" stroke-width="1.5" stroke-linecap="round" d="M${cx - 9.5} 92 Q${cx} 84.2 ${cx + 9.5} 92"/>
    <path fill="none" stroke="${skinDark}" stroke-width=".9" opacity=".7" d="M${cx - 7} 94.5 Q${cx} 98.4 ${cx + 7} 94.5"/>`;

  const brows = `<path fill="none" stroke="${hairDark}" stroke-width="${soft ? 2 : 3}" stroke-linecap="round" opacity=".9" d="M71 ${soft ? 81 : 82} Q82 ${soft ? 76.5 : 78} 93 80"/>
    <path fill="none" stroke="${hairDark}" stroke-width="${soft ? 2 : 3}" stroke-linecap="round" opacity=".9" d="M107 80 Q118 ${soft ? 76.5 : 78} 129 ${soft ? 81 : 82}"/>`;

  const beardSvg = beard
    ? `<path fill="${H}" opacity=".92" d="M62 100 C64 126 80 146 100 147 C120 146 136 126 138 100 C132 116 124 120 116 118 Q108 117 112 128 Q100 134 88 128 Q92 117 84 118 C76 120 68 116 62 100Z"/>
       <path fill="${H}" d="M86 121 Q93 116 100 119 Q107 116 114 121 Q107 119.5 100 121 Q93 119.5 86 121Z"/>`
    : '';

  const glassesSvg = glasses
    ? `<g fill="none" stroke="#2b2b30" stroke-width="1.8"><rect x="69" y="83" width="26" height="18" rx="7"/><rect x="105" y="83" width="26" height="18" rx="7"/><path d="M95 90 Q100 87 105 90 M69 89 L61 87 M131 89 L139 87"/></g>`
    : '';

  const earringsSvg = earrings
    ? `<g fill="none" stroke="#e2b23c" stroke-width="1.8"><circle cx="60" cy="112" r="4"/><circle cx="140" cy="112" r="4"/></g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 18 172 172" width="200" height="200">${defs}
  <g clip-path="url(#${id}c)">
    <rect width="200" height="200" fill="url(#${id}bg)"/>
    ${back}
    ${body}
    <path fill="url(#${id}neck)" d="M87 124 L113 124 L116 150 Q100 158 84 150Z"/>
    <ellipse cx="60" cy="96" rx="6" ry="10" fill="${skin}"/><ellipse cx="140" cy="96" rx="6" ry="10" fill="${skin}"/>
    <ellipse cx="60.5" cy="96" rx="2.6" ry="5.5" fill="${skinDark}" opacity=".5"/><ellipse cx="139.5" cy="96" rx="2.6" ry="5.5" fill="${skinDark}" opacity=".5"/>
    <path fill="url(#${id}skin)" d="M61 86 C61 52 78 40 100 40 C122 40 139 52 139 86 C139 108 133 124 121 135 Q110 144 100 144 Q90 144 79 135 C67 124 61 108 61 86Z"/>
    <path fill="${skinDark}" opacity=".18" d="M64 100 C66 120 78 136 100 142 C84 134 72 120 64 100Z M136 100 C134 120 122 136 100 142 C116 134 128 120 136 100Z"/>
    ${earringsSvg}
    <ellipse cx="75" cy="111" rx="11" ry="7" fill="url(#${id}blush)"/><ellipse cx="125" cy="111" rx="11" ry="7" fill="url(#${id}blush)"/>
    ${beardSvg}
    ${eyeShape(82)}${eyeShape(118)}
    ${lashes}
    ${brows}
    <path fill="none" stroke="${skinDark}" stroke-width="1.4" stroke-linecap="round" opacity=".55" d="M96 92 C95 100 93 106 92.5 110"/>
    <path fill="none" stroke="${skinLight}" stroke-width="2.4" stroke-linecap="round" opacity=".7" d="M100.5 94 L101 107"/>
    <path fill="${skinDark}" opacity=".45" d="M92 111 Q96 115 100 113.5 Q104 115 108 111 Q106 116.5 100 116.5 Q94 116.5 92 111Z"/>
    <ellipse cx="96" cy="113" rx="2" ry="1.1" fill="${shade(skin, -0.5)}" opacity=".6"/><ellipse cx="104" cy="113" rx="2" ry="1.1" fill="${shade(skin, -0.5)}" opacity=".6"/>
    <path fill="${lip}" d="M88 124 Q94 121 100 122.5 Q106 121 112 124 Q106 125.5 100 125.5 Q94 125.5 88 124Z"/>
    <path fill="${shade(lip, 0.12)}" d="M89 124.5 Q100 126.5 111 124.5 Q106 131 100 131 Q94 131 89 124.5Z"/>
    <path fill="#ffffff" opacity=".25" d="M95 127.5 Q100 129.5 105 127.5 Q100 128.6 95 127.5Z"/>
    <path fill="none" stroke="${shade(lip, -0.4)}" stroke-width="1.1" stroke-linecap="round" d="M87.5 123.6 Q100 127.8 112.5 123.6"/>
    ${glassesSvg}
    ${front}
  </g>
</svg>
`;
}

for (let i = 1; i <= count; i++) {
  fs.writeFileSync(`${out}/cartoon-${String(i).padStart(2, '0')}.svg`, avatar(i));
}
