// Generates 50 soft-shaded cartoon avatars (own drawing, no third-party art).
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
    <radialGradient id="${id}blush" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff6f7d" stop-opacity=".45"/><stop offset="1" stop-color="#ff6f7d" stop-opacity="0"/></radialGradient>
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
    ? `<path fill="none" stroke="#1d1410" stroke-width="2" stroke-linecap="round" d="M71 84 L67 80 M74 81 L71 77 M126 84 L130 80 M123 81 L126 77"/>`
    : '';
  const eyeShape = (cx) => `
    <ellipse cx="${cx}" cy="92" rx="11.5" ry="13" fill="url(#${id}eyew)"/>
    <circle cx="${cx + 1}" cy="94" r="7.6" fill="url(#${id}iris)"/>
    <circle cx="${cx + 1}" cy="94" r="3.8" fill="#14100e"/>
    <circle cx="${cx + 3.6}" cy="90.4" r="2.6" fill="#ffffff"/>
    <circle cx="${cx - 1.6}" cy="97" r="1.1" fill="#ffffff" opacity=".85"/>
    <path fill="none" stroke="#2a1c16" stroke-width="2.4" stroke-linecap="round" d="M${cx - 11.5} 90 Q${cx} 76 ${cx + 11.5} 90"/>`;

  const brows = `<path fill="none" stroke="${hairDark}" stroke-width="${soft ? 3.2 : 4.6}" stroke-linecap="round" d="M70 ${soft ? 73 : 74} Q83 ${soft ? 66 : 67} 94 72"/>
    <path fill="none" stroke="${hairDark}" stroke-width="${soft ? 3.2 : 4.6}" stroke-linecap="round" d="M106 72 Q117 ${soft ? 66 : 67} 130 ${soft ? 73 : 74}"/>`;

  const beardSvg = beard
    ? `<path fill="${H}" d="M60 104 C62 132 80 152 100 152 C120 152 138 132 140 104 C134 118 126 122 118 118 Q100 112 82 118 C74 122 66 118 60 104Z"/>
       <path fill="${H}" d="M84 114 Q100 106 116 114 Q100 112 84 114Z"/>`
    : '';

  const glassesSvg = glasses
    ? `<g fill="none" stroke="#2b2b30" stroke-width="2.6"><rect x="67" y="80" width="30" height="25" rx="9"/><rect x="103" y="80" width="30" height="25" rx="9"/><path d="M97 90 Q100 87 103 90 M67 88 L57 85 M133 88 L143 85"/></g>`
    : '';

  const earringsSvg = earrings
    ? `<g fill="none" stroke="#e2b23c" stroke-width="2.6"><circle cx="57" cy="116" r="6"/><circle cx="143" cy="116" r="6"/></g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 18 172 172" width="200" height="200">${defs}
  <g clip-path="url(#${id}c)">
    <rect width="200" height="200" fill="url(#${id}bg)"/>
    ${back}
    ${body}
    <path fill="url(#${id}neck)" d="M86 118 L114 118 L116 148 Q100 156 84 148Z"/>
    <ellipse cx="57" cy="98" rx="7.5" ry="11" fill="${skin}"/><ellipse cx="143" cy="98" rx="7.5" ry="11" fill="${skin}"/>
    <ellipse cx="57.5" cy="98" rx="3.5" ry="6" fill="${skinDark}" opacity=".5"/><ellipse cx="142.5" cy="98" rx="3.5" ry="6" fill="${skinDark}" opacity=".5"/>
    <path fill="url(#${id}skin)" d="M58 88 C58 52 76 40 100 40 C124 40 142 52 142 88 C142 120 124 140 100 140 C76 140 58 120 58 88Z"/>
    ${earringsSvg}
    <ellipse cx="75" cy="111" rx="11" ry="7" fill="url(#${id}blush)"/><ellipse cx="125" cy="111" rx="11" ry="7" fill="url(#${id}blush)"/>
    ${beardSvg}
    ${eyeShape(82)}${eyeShape(118)}
    ${lashes}
    ${brows}
    <path fill="${skinDark}" opacity=".55" d="M96 108 Q100 113 104 108 Q103 111 100 111.5 Q97 111 96 108Z"/>
    <path fill="none" stroke="${skinLight}" stroke-width="2" stroke-linecap="round" opacity=".8" d="M99 96 L99 104"/>
    <path fill="#6b1d27" d="M82 118 Q100 140 118 118 Q100 124 82 118Z"/>
    <g clip-path="url(#${id}m)"><rect x="80" y="116" width="40" height="7" fill="#ffffff"/><ellipse cx="100" cy="134" rx="9" ry="6" fill="#e86a78"/></g>
    <path fill="none" stroke="${skinDark}" stroke-width="1.6" stroke-linecap="round" d="M80 117 Q78 116 77 114 M120 117 Q122 116 123 114"/>
    ${glassesSvg}
    ${front}
  </g>
</svg>
`;
}

for (let i = 1; i <= count; i++) {
  fs.writeFileSync(`${out}/cartoon-${String(i).padStart(2, '0')}.svg`, avatar(i));
}
