import * as THREE from 'three';
import { ARENA, INK, POND } from './config.js';

export const hash = (x, y, s = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
const grid = (w, h, at) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => at(x, y)).join(''));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const abgr = (hex) => { const [r, g, b] = rgb(hex); return (255 << 24) | (b << 16) | (g << 8) | r; };

const HERO = [
  '...hhhhhh...',
  '..hHHhhhhh..',
  '.hHHhhhhhhh.',
  '.hhsssssshh.',
  '.hskssskssh.',
  '.hsssssssch.',
  '..hssssssc..',
  '..chhhhhhc..',
  '.chhhtthhhc.',
  '.chhhtthhhcs',
  '.cchhtthhcck',
  '.cchhhhhhcyY',
  '..chhhhhhcyy',
  '..cchhhhcc.y',
];
const LEGS = [['...bb..bb...', '...bb..bb...', '..bbb..bbb..'], ['...bb..bb...', '..bb....bb..', '..bb.....bbb'], ['...bb..bb...', '...bb..bb...', '..bbb..bbb..'], ['...bb..bb...', '....bbbb....', '...bbbbb....']];
const WISP = [
  ['...vvvv...', '..vVVvvv..', '.vVVvvvvv.', '.vvevvevv.', '.vvevvevv.', '.vvvvvvvv.', '.vvvmmvvv.', '.vvvvvvvv.', '.vv.vvv.v.', '..v..v....'],
  ['...vvvv...', '..vVVvvv..', '.vVVvvvvv.', '.vvevvevv.', '.vvevvevv.', '.vvvvvvvv.', '.vvvmmvvv.', '.vvvvvvvv.', '.v.vvv.vv.', '....v..v..'],
];
const BAT = [
  ['m....mm....m', 'mm..mmmm..mm', 'mmmmmrmrmmmm', '.mmmmmmmmmm.', '..mm.mm.mm..', '.....mm.....'],
  ['....mmmm....', '...mrmmrm...', '.mmmmmmmmmm.', 'mmmmmmmmmmmm', 'mm.m.mm.m.mm', 'm....mm....m'],
];
const HUSK = [
  ['...wwww...', '..wwwwww..', '..wkwwkw..', '..wwwwWW..', '...wkkW...', '....ww....', '.wwwwwwWW.', '.w.wkkw.W.', '.w.wwwW.W.', '.w.wkkw.W.', '...wwwW...', '...w..W...', '...w..W...', '..ww..WW..'],
  ['...wwww...', '..wwwwww..', '..wkwwkw..', '..wwwwWW..', '...wkkW...', '....ww....', '.wwwwwwWW.', 'w..wkkw..W', 'w..wwwW..W', '...wkkw...', '...wwwW...', '..w....W..', '..w....W..', '.ww....WW.'],
];
const KNIGHT = [
  ['.....rr.....', '....rrr.....', '...AAaaaa...', '..AAaaaaaa..', '..aeeeeeea..', '..aaaaaaaa..', '...aaaaaa...', '.AAaaAAaaaa.', 'AAaaaAAaaaaa', 'Aa.aaaaaa.aa', 'aa.aaAAaa.aa', 'aa.aaaaaa.aa', '...aa..aa...', '...aa..aa...', '..aaa..aaa..'],
  ['.....rr.....', '....rrr.....', '...AAaaaa...', '..AAaaaaaa..', '..aeeeeeea..', '..aaaaaaaa..', '...aaaaaa...', '.AAaaAAaaaa.', 'AAaaaAAaaaaa', 'Aa.aaaaaa.aa', 'aa.aaAAaa.aa', '...aaaaaa...', '..aa....aa..', '..aa....aa..', '.aaa....aaa.'],
];
const EMBER = ['..Y..', '.YOy.', 'YOyyo', 'Oyyoo', '.yoo.', '..o..'];
const FLAME = ['...o...', '..oo...', '..oOo..', '.ooOo..', '.oOYOo.', 'oOYYOo.', 'oOYYOoo', '.oOYOo.', '..ooo..'];
const TUFT = ['g..L..g', 'g.gG.g.', '.gGgLg.', '.GgGgG.', '..GGG..'];
const BLOOM = ['.p.p.', 'ppypp', '.ppp.', '..G..', '.GG..', '..G..'];
const LEAF = ['Lg', 'gG'];
const PETAL = ['pp', 'p.'];
const HEART = ['.rr.rr.', 'rRRrrrr', 'rRrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const LODE = ['ww...ww', 'rr...rr', 'rr...rr', 'aa...aa', 'aAa.aaa', '.aAaaa.', '..aaa..'];

const tree = (seed) => grid(24, 32, (x, y) => {
  const blob = [[11.5, 10, 9], [6, 15, 6], [17, 15, 6], [11.5, 5, 5.5]].find(([cx, cy, r]) => Math.hypot(x - cx, (y - cy) * 1.1) < r - hash(x, y, seed) * 1.6);
  if (blob) {
    const shade = (x - blob[0]) * 0.35 + (y - blob[1]) * 0.8 + hash(x, y, seed + 1) * 5 - 2.5;
    return shade < -4 ? 'L' : shade < 0 ? 'g' : shade < 4 ? 'G' : 'D';
  }
  const trunk = y >= 18 && Math.abs(x - 11.5) < 1.6 + Math.max(0, y - 28) * 0.7;
  return trunk ? (x > 11.5 ? 'N' : 'n') : '.';
});
const rock = (seed) => grid(12, 8, (x, y) => {
  if (Math.hypot((x - 5.5) / 5.5, (y - 4.5) / 3.6) > 1 - hash(x, y, seed) * 0.2) return '.';
  const shade = (x - 5.5) * 0.3 + (y - 3) + hash(x, y, seed + 2) * 1.5;
  return shade < -1 ? 'w' : shade < 2 ? 'z' : 'Z';
});

const outline = (rows, ink = 'k') => {
  const padded = ['', ...rows, ''].map((row) => `.${row.padEnd(rows[0].length, '.')}.`);
  const solid = (x, y) => (padded[y]?.[x] ?? '.') !== '.';
  return padded.map((row, y) => [...row].map((ch, x) => (ch === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ? ink : ch)).join(''));
};

const SHEET = {
  hero: LEGS.map((legs) => [...HERO, ...legs]),
  wisp: WISP,
  bat: BAT,
  husk: HUSK,
  knight: KNIGHT,
  ember: [EMBER],
  flame: [FLAME],
  heart: [HEART],
  lode: [LODE],
  leaf: [LEAF],
  petal: [PETAL],
  tuft: [TUFT],
  bloom: [BLOOM],
  tree: [tree(1), tree(2), tree(3)],
  rock: [rock(1), rock(2)],
};

const FLORA = ['tuft', 'bloom', 'tree', 'leaf'];

export const buildAtlas = () => {
  const W = 256;
  const H = 128;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d');
  const pen = { x: 0, y: 0, row: 0 };
  const place = (rows) => {
    const w = rows[0].length;
    const h = rows.length;
    if (pen.x + w > W) Object.assign(pen, { x: 0, y: pen.y + pen.row, row: 0 });
    const at = { x: pen.x, y: pen.y };
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = INK[ch];
      ctx.fillRect(at.x + x, at.y + y, 1, 1);
    }));
    Object.assign(pen, { x: pen.x + w + 1, row: Math.max(pen.row, h + 1) });
    return { uv: [at.x / W, 1 - (at.y + h) / H, w / W, h / H], aspect: w / h };
  };
  const frames = Object.fromEntries(Object.entries(SHEET).map(([name, set]) => [name, set.map((rows) => place(outline(rows, FLORA.includes(name) ? 'q' : 'k')))]));
  const map = new THREE.CanvasTexture(canvas);
  Object.assign(map, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false, colorSpace: THREE.SRGBColorSpace });
  return { map, frames, canvas };
};

const smooth = (x, y, s) => {
  const [ix, iy] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - ix, y - iy];
  const top = hash(ix, iy, s) + (hash(ix + 1, iy, s) - hash(ix, iy, s)) * fx;
  const low = hash(ix, iy + 1, s) + (hash(ix + 1, iy + 1, s) - hash(ix, iy + 1, s)) * fx;
  return top + (low - top) * fy;
};
const GRASS = ['#35573a', '#3f6640', '#4a7445', '#57844b', '#67954f'].map(abgr);
const DIRT = ['#6b543f', '#7c6348', '#8d7354'].map(abgr);
const STONE = ['#77747f', '#86838e', '#96939c'].map(abgr);
const MORTAR = abgr('#4c4956');
const BED = abgr('#16303a');
const SPECK = ['#e48fb0', '#ffd36b', '#e8e2d0'].map(abgr);

export const surface = (x, z) => {
  const shore = Math.hypot(x - POND.x, z - POND.z) - POND.r;
  if (shore < -0.25) return 'water';
  if (shore < 1.1 + smooth(x, z, 11) * 0.8) return 'dirt';
  if (Math.hypot(x, z) < 7.2 + smooth(x * 0.8, z * 0.8, 4) * 1.6) return 'stone';
  const road = Math.min(Math.abs(z - Math.sin(x * 0.17) * 3.2), Math.abs(x - Math.sin(z * 0.14) * 3.6));
  return road < 1.25 + smooth(x, z, 9) * 0.9 ? 'dirt' : 'grass';
};

const texel = (px, py) => {
  const unit = ARENA.size / ARENA.px;
  const [x, z] = [(px - ARENA.px / 2) * unit, (py - ARENA.px / 2) * unit];
  const grain = hash(px, py);
  const kind = surface(x, z);
  if (kind === 'stone') {
    const row = Math.floor(z / 0.9);
    const sx = x + (((row % 2) + 2) % 2) * 0.6;
    const edge = Math.min(((z % 0.9) + 0.9) % 0.9, ((sx % 1.2) + 1.2) % 1.2);
    if (edge < unit * 1.1) return MORTAR;
    return STONE[Math.min(2, Math.floor(hash(Math.floor(sx / 1.2), row, 7) * 2.2 + grain * 0.9))];
  }
  if (kind === 'water') return BED;
  if (kind === 'dirt') return DIRT[Math.floor(grain * 2.99)];
  if (grain < 0.004) return SPECK[Math.floor(hash(py, px) * 2.99)];
  return GRASS[Math.min(4, Math.floor(smooth(x * 0.35, z * 0.35, 2) * 3.4 + grain * 1.6))];
};

export const paintGround = () => {
  const canvas = Object.assign(document.createElement('canvas'), { width: ARENA.px, height: ARENA.px });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(ARENA.px, ARENA.px);
  const data = new Uint32Array(image.data.buffer);
  for (let i = 0; i < data.length; i += 1) data[i] = texel(i % ARENA.px, Math.floor(i / ARENA.px));
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  Object.assign(map, { magFilter: THREE.NearestFilter, colorSpace: THREE.SRGBColorSpace, anisotropy: 4 });
  return map;
};

export const paintStone = () => {
  const canvas = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });
  const ctx = canvas.getContext('2d');
  grid(32, 32, (x, y) => {
    const row = Math.floor(y / 8);
    const sx = x + (row % 2) * 8;
    const seam = y % 8 === 0 || sx % 16 === 0;
    const moss = hash(x, y, 5) < 0.06;
    ctx.fillStyle = seam ? '#4c4956' : moss ? '#4a7445' : ['#77747f', '#86838e', '#96939c'][Math.floor(hash(Math.floor(sx / 16), row, 3) * 2 + hash(x, y, 6) * 0.99)];
    ctx.fillRect(x, y, 1, 1);
    return '';
  });
  const map = new THREE.CanvasTexture(canvas);
  Object.assign(map, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, generateMipmaps: false, colorSpace: THREE.SRGBColorSpace, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  return map;
};
