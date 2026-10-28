export const ARENA = { radius: 34, size: 96, px: 1024, night: 360 };
export const POND = { x: -14, z: 9, r: 4.6 };

export const INK = {
  k: '#1b1428', h: '#8a2f3d', H: '#b84a55', c: '#5a1f30', s: '#f2c9a2', t: '#e3d3a8',
  b: '#3b2a2c', y: '#ffd36b', Y: '#fff3c4', v: '#6a4fb0', V: '#9a82de', e: '#fff0b0',
  m: '#4a3560', r: '#ff5a4a', w: '#e8e2d0', W: '#b9b29c', a: '#3c4258', A: '#6a7392',
  g: '#6fae4e', G: '#3f7a3c', p: '#e48fb0', o: '#ff9a3c', O: '#ffe08a', n: '#7a6a5a', N: '#54463e', D: '#2b5a3d', L: '#9bcf66', z: '#8d8a94', Z: '#5f5c6b', q: '#16301f', R: '#ffb0a0',
};

export const SKY = [
  { at: 0, sun: '#ffb27a', sky: '#8e7fd0', ground: '#3a2c4a', fog: '#2a2140', power: 2.2 },
  { at: 0.3, sun: '#8fa8ff', sky: '#3d4a9a', ground: '#141226', fog: '#141226', power: 1.1 },
  { at: 0.8, sun: '#8fa8ff', sky: '#34407f', ground: '#141226', fog: '#12101f', power: 1.0 },
  { at: 1, sun: '#ffd7a0', sky: '#e39ab0', ground: '#5a3c4a', fog: '#5a3a52', power: 2.6 },
];

export const FOES = {
  wisp: { sprite: 'wisp', from: 0, hp: 3, speed: 1.7, hit: 6, xp: 1, size: 1.1, r: 0.42 },
  bat: { sprite: 'bat', from: 35, hp: 2, speed: 3.1, hit: 5, xp: 1, size: 1.1, r: 0.36, flies: true },
  husk: { sprite: 'husk', from: 80, hp: 13, speed: 1.35, hit: 10, xp: 3, size: 1.5, r: 0.45 },
  knight: { sprite: 'knight', from: 170, hp: 42, speed: 1.15, hit: 16, xp: 8, size: 1.9, r: 0.6 },
};

const step = (lv, from, to) => from + ((to - from) * (lv - 1)) / 4;

export const BOONS = [
  { id: 'bolt', name: 'Ember Bolt', arm: true, text: (lv) => (lv === 1 ? 'Hurls a bolt at the nearest shade.' : ['', '', 'Faster, harder.', 'A second bolt.', 'Bolts pierce.', 'A third bolt.'][lv]) },
  { id: 'ward', name: 'Wardlight', arm: true, text: (lv) => (lv === 1 ? 'Two flames circle you and burn what they touch.' : 'One more flame in the ring.') },
  { id: 'star', name: 'Starfall', arm: true, text: (lv) => (lv === 1 ? 'A star drops on a nearby shade.' : 'More stars, wider blast.') },
  { id: 'nova', name: 'Bellstroke', arm: true, text: (lv) => (lv === 1 ? 'A ring of light throws back everything near.' : 'Rings sooner and reaches further.') },
  { id: 'lance', name: 'Dawnlance', arm: true, text: (lv) => (lv === 1 ? 'A lance of light strikes everything ahead of you.' : 'Longer, sooner, harder.') },
  { id: 'wick', name: 'Long Wick', text: () => 'The lantern reaches 25% further. Embers come to its light.' },
  { id: 'swift', name: 'Pilgrim Boots', text: () => 'Walk 10% faster.' },
  { id: 'vigor', name: 'Hearth Bread', text: () => 'Mends 25 and raises your health by 20.' },
  { id: 'haste', name: 'Hourglass', text: () => 'Everything fires 9% sooner.' },
  { id: 'might', name: 'Whetstone', text: () => 'Everything hits 18% harder.' },
];

export const ARMS = {
  bolt: (lv) => ({ every: step(lv, 0.55, 0.38), hit: step(lv, 4, 9), count: lv >= 5 ? 3 : lv >= 3 ? 2 : 1, pierce: lv >= 4 ? 2 : 0 }),
  ward: (lv) => ({ count: lv + 1, hit: 2 + lv, reach: 2.3 }),
  star: (lv) => ({ every: step(lv, 2.6, 1.5), hit: 8 + lv * 4, count: lv, reach: 1.6 + lv * 0.15 }),
  lance: (lv) => ({ every: step(lv, 3, 1.8), hit: 6 + lv * 4, reach: 8 + lv }),
  nova: (lv) => ({ every: step(lv, 5, 3), hit: 4 + lv * 3, reach: 3.4 + lv * 0.5 }),
};

export const MAX_LEVEL = 5;
export const xpFor = (level) => Math.floor(4 + level * 2 + level * level * 0.5);
