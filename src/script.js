import { ARENA, ARMS, BOONS, FOES, MAX_LEVEL, POND, xpFor } from './config.js';
import { createStage } from './stage.js';
import { chord, setMuted, tone, wake } from './audio.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const GOLD = [1, 0.55, 0.16];
const VIOLET = [0.55, 0.38, 1];
const FROST = [0.6, 0.8, 1.3];
const DAWN = [1.3, 1, 0.55];
const ROSE = [1, 0.3, 0.3];
const DUST = [0.3, 0.26, 0.22];
const ZOOM = { title: 0.8, play: 1, boon: 0.9, paused: 0.94, dying: 0.72, fallen: 0.72, dawn: 1.3 };
const DASH = { time: 0.16, rest: 2.2, pace: 4 };
const RANKS = [{ hp: 1, grow: 1 }, { hp: 14, grow: 1.8 }, { hp: 80, grow: 2.9 }];
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = createStage($('stage'));
const store = {
  read: (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {  } },
};
const fresh = () => ({
  time: 0,
  kills: 0,
  shake: 0,
  streak: 0,
  lull: 0,
  hero: { x: 0, z: 2.5, hp: 100, max: 100, face: 1, step: 0, hurt: 0, safe: 0, dash: 0, rest: 0, aim: [1, 0], dust: 0, level: 1, xp: 0, moving: false },
  boons: { bolt: 1 },
  clocks: { spawn: 2, elite: 45, omen: 28, bolt: 0.4, star: 1, nova: 1, lance: 1 },
  omens: 0,
  king: false,
  finds: [],
  beams: [],
  husks: [],
  foes: [],
  shots: [],
  stars: [],
  rings: [],
  embers: [],
  sparks: [],
});
const game = fresh();
const ui = { mode: 'title', lamp: 1, freeze: 0, dying: 0, clock: 0, last: performance.now(), muted: store.read('lanternfall.mute', false), best: store.read('lanternfall.best', null), shown: {} };
const rank = (id) => game.boons[id] ?? 0;
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const keys = new Set();
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const held = (...codes) => Number(codes.some((code) => keys.has(code)));
const heading = () => {
  const x = held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft') + stick.x;
  const z = held('KeyS', 'ArrowDown') - held('KeyW', 'ArrowUp') + stick.y;
  const length = Math.hypot(x, z);
  if (length < 0.15 || ui.mode !== 'play') return [0, 0];
  return length > 1 ? [x / length, z / length] : [x, z];
};
const dropStick = () => {
  Object.assign(stick, { id: null, x: 0, y: 0 });
  $('stick').hidden = true;
};

const pops = Array.from({ length: 26 }, () => $('hits').appendChild(document.createElement('span')));
const popAt = { next: 0 };
const pop = (x, y, z, text, kind = '') => {
  const el = pops[popAt.next % pops.length];
  const [sx, sy] = stage.project(x, y, z);
  popAt.next += 1;
  el.textContent = text;
  el.className = kind;
  el.animate([
    { opacity: 1, transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${calm ? 1 : 1.35})` },
    { opacity: 1, offset: 0.6 },
    { opacity: 0, transform: `translate(${sx}px, ${sy - (calm ? 0 : 38)}px) translate(-50%, -50%) scale(1)` },
  ], { duration: 520, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
};
const burst = (x, y, z, count, color, force = 4) => {
  if (game.sparks.length > 320) return;
  game.sparks.push(...Array.from({ length: count }, () => {
    const turn = Math.random() * TAU;
    const push = force * (0.4 + Math.random() * 0.6);
    return { x, y, z, vx: Math.cos(turn) * push, vy: 2 + Math.random() * 3, vz: Math.sin(turn) * push, life: 1, fade: 1.6 + Math.random() * 1.6, size: 0.25 + Math.random() * 0.3, color };
  }));
};

const omen = (text) => {
  $('omen').textContent = text;
  $('omen').animate([{ opacity: 0, transform: `scale(${calm ? 1 : 1.12})` }, { opacity: 1, transform: 'scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2800, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  tone(70, { type: 'sawtooth', dur: 0.6, vol: 0.07, slide: 0.7 });
};

const sheet = (mode, { eyebrow, title, text, button = '', note = '', cards = [] }) => {
  ui.mode = mode;
  $('sheet').dataset.mode = mode;
  $('sheet').hidden = false;
  $('sheet-eyebrow').textContent = eyebrow;
  $('sheet-title').textContent = title;
  $('sheet-text').textContent = text;
  $('sheet-note').textContent = note;
  $('go').textContent = button;
  $('go').hidden = !button;
  $('boons').replaceChildren(...cards);
  ($('boons').querySelector('button') ?? $('go')).focus({ preventScroll: true });
  dropStick();
};
const HINT = 'Move with WASD or drag. Space to dash. The lantern does the rest.';
const record = () => (ui.best ? `Longest vigil ${clock(ui.best.time)} · ${ui.best.kills} shades` : 'A vigil in the ruined vale');
const resume = () => {
  ui.mode = 'play';
  $('sheet').hidden = true;
  $('stage').focus();
};
const begin = () => {
  Object.assign(game, fresh());
  Object.assign(ui, { shown: {}, lamp: 1, freeze: 0 });
  ['hud', 'kit', 'dash'].forEach((id) => { $(id).hidden = false; });
  wake();
  chord([392, 523, 659], { dur: 0.3, vol: 0.05 });
  resume();
};
const end = (mode) => {
  const beaten = game.time > (ui.best?.time ?? 0) || game.kills > (ui.best?.kills ?? 0);
  ui.best = { time: Math.max(game.time, ui.best?.time ?? 0), kills: Math.max(game.kills, ui.best?.kills ?? 0) };
  store.write('lanternfall.best', ui.best);
  const tally = `You kept the light for ${clock(game.time)}, reached level ${game.hero.level} and laid ${game.kills} shades to rest.`;
  const note = beaten ? 'A new record for this lantern.' : `${record()}.`;
  if (mode === 'dawn') chord([392, 494, 587, 784], { dur: 0.6, vol: 0.06 });
  sheet(mode, mode === 'dawn'
    ? { eyebrow: 'The vigil is kept', title: 'Dawn breaks', text: tally, button: 'Keep another vigil', note }
    : { eyebrow: 'The vigil is broken', title: 'The lantern gutters', text: tally, button: 'Light it again', note });
};
const pause = () => ui.mode === 'play' && sheet('paused', { eyebrow: `Dawn in ${clock(ARENA.night - game.time)}`, title: 'Vigil paused', text: 'The shades wait where they stand.', button: 'Take up the lantern' });

const take = (boon) => {
  game.boons[boon.id] = rank(boon.id) + 1;
  if (boon.id === 'vigor') Object.assign(game.hero, { max: game.hero.max + 20, hp: Math.min(game.hero.max + 20, game.hero.hp + 25) });
  chord([523, 784], { dur: 0.2, vol: 0.05 });
  game.hero.safe = 1.2;
  game.rings.push({ x: game.hero.x, z: game.hero.z, t: 0, reach: 5, hit: 0, id: game.time + 0.5 });
  resume();
};
const card = (boon, i) => {
  const next = rank(boon.id) + 1;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'boon';
  el.innerHTML = `<span class="boon__icon"><svg><use href="#i-${boon.id}"/></svg></span>
    <span class="boon__name">${boon.name} <span class="boon__rank">${next === 1 ? 'New' : `Rank ${next}`}</span></span>
    <span class="boon__text">${boon.text(next)}</span>`;
  el.setAttribute('aria-keyshortcuts', String(i + 1));
  el.addEventListener('click', () => take(boon));
  return el;
};
const levelUp = () => {
  const { hero } = game;
  hero.xp -= xpFor(hero.level);
  hero.level += 1;
  const deal = BOONS.filter((boon) => rank(boon.id) < MAX_LEVEL).map((boon) => [Math.random(), boon]).sort(([a], [b]) => a - b).slice(0, 3).map(([, boon]) => boon);
  chord([523, 659, 784, 1047], { dur: 0.22, vol: 0.05 });
  stage.flash(hero.x, hero.z, 14);
  if (!calm) $('xp').animate([{ filter: 'brightness(3)' }, { filter: 'brightness(1)' }], { duration: 600 });
  if (!deal.length) { hero.hp = Math.min(hero.max, hero.hp + 30); return; }
  sheet('boon', { eyebrow: `Level ${hero.level}`, title: 'The lantern brightens', text: 'Choose one boon to carry.', cards: deal.map(card) });
};

const shove = (body, r, blocks) => blocks.forEach((block) => {
  const d = gap(body, block);
  const min = block.r + r;
  if (d >= min || d === 0) return;
  Object.assign(body, { x: block.x + ((body.x - block.x) / d) * min, z: block.z + ((body.z - block.z) / d) * min });
});
const spawn = ({ tier = 0, kind, turn = Math.random() * TAU, far = 1 } = {}) => {
  const open = Object.values(FOES).filter((foe) => foe.from <= game.time);
  const { hp, grow } = RANKS[tier];
  const breed = kind ?? (tier ? open.at(-1) : open[Math.floor(Math.random() ** 1.25 * open.length)]);
  game.foes.push({
    kind: breed,
    elite: tier > 0,
    king: tier === 2,
    x: game.hero.x + Math.cos(turn) * 18 * far,
    z: game.hero.z + Math.sin(turn) * 15 * far,
    hp: breed.hp * (1 + game.time / 110) * hp,
    size: breed.size * grow,
    r: breed.r * grow,
    flash: 0,
    kx: 0,
    kz: 0,
    ward: 0,
    ring: 0,
    seed: Math.random() * 10,
    age: 0,
  });
};
const strike = (foe, amount, kx = 0, kz = 0) => {
  if (foe.hp <= 0) return;
  const dealt = Math.round(amount * (1 + 0.18 * rank('might')));
  const weight = foe.elite ? 0.3 : 1;
  Object.assign(foe, { hp: foe.hp - dealt, flash: 0.12, kx: foe.kx + kx * weight, kz: foe.kz + kz * weight });
  if (dealt) pop(foe.x, foe.size, foe.z, dealt);
  if (foe.hp > 0) return;
  const ember = { x: foe.x, z: foe.z, xp: foe.elite ? xpFor(game.hero.level) : foe.kind.xp, pull: 0, seed: foe.seed, big: foe.elite, age: 0 };
  game.husks.push({ sprite: foe.kind.sprite, x: foe.x, z: foe.z, y: foe.kind.flies ? 0.9 : 0, size: foe.size, flip: foe.x < game.hero.x ? 1 : -1, t: 0 });
  const luck = Math.random();
  shove(ember, 0.4, [POND]);
  game.kills += 1;
  if (game.embers.length > 240) game.embers[Math.floor(Math.random() * 240)].xp += ember.xp;
  else game.embers.push(ember);
  if (foe.elite || luck < 0.018) game.finds.push({ x: ember.x + 0.5, z: ember.z, kind: foe.elite || luck < 0.011 ? 'heart' : 'lode', seed: foe.seed });
  if (foe.king) chord([196, 294, 392, 587], { dur: 0.5, vol: 0.07 });
  burst(foe.x, foe.size * 0.5, foe.z, foe.elite ? 18 : 5, VIOLET);
  if (foe.elite) {
    game.shake = 0.5;
    ui.freeze = calm ? 0 : 0.08;
  }
  if (ui.clock - game.lull > 0.05) tone(180 + Math.random() * 60, { type: 'square', dur: 0.07, vol: 0.025, slide: 0.5 });
  game.lull = ui.clock;
};
const wound = (amount) => {
  const { hero } = game;
  Object.assign(hero, { hp: hero.hp - amount, hurt: 0.7 });
  game.shake = 0.6;
  pop(hero.x, 2, hero.z, `-${amount}`, 'hurt');
  tone(110, { type: 'sawtooth', dur: 0.22, vol: 0.08, slide: 0.5 });
  ui.freeze = calm ? 0 : 0.06;
  if (hero.hp > 0) return;
  Object.assign(ui, { mode: 'dying', dying: 1.4 });
  dropStick();
  tone(220, { type: 'triangle', dur: 1.2, vol: 0.08, slide: 0.2 });
};
const wardFlames = () => {
  if (!rank('ward')) return [];
  const arm = ARMS.ward(rank('ward'));
  return Array.from({ length: arm.count }, (_, i) => {
    const turn = game.time * 2.8 + (i / arm.count) * TAU;
    return { x: game.hero.x + Math.cos(turn) * arm.reach, z: game.hero.z + Math.sin(turn) * arm.reach, hit: arm.hit };
  });
};

const dash = () => {
  const { hero } = game;
  if (ui.mode !== 'play' || hero.rest > 0) return;
  Object.assign(hero, { dash: DASH.time, rest: DASH.rest });
  tone(300, { type: 'sine', dur: 0.16, vol: 0.05, slide: 2.4 });
};
const OMENS = [
  ['The circle closes', () => {
    const count = Math.min(40, 18 + Math.floor(game.time / 12));
    Array.from({ length: count }, (_, i) => spawn({ kind: FOES.wisp, turn: (i / count) * TAU, far: 0.62 }));
  }],
  ['Wings in the dark', () => {
    const from = Math.random() * TAU;
    Array.from({ length: Math.min(30, 10 + Math.floor(game.time / 15)) }, (_, i) => spawn({ kind: FOES.bat, turn: from + (i - 6) * 0.05, far: 0.8 + (i % 4) * 0.08 }));
  }],
];

const update = (dt) => {
  const { hero, clocks, foes } = game;
  const quick = 1 - 0.09 * rank('haste');
  const [mx, mz] = heading();
  const pace = 4.6 * (1 + 0.1 * rank('swift'));
  game.time += dt;
  const turn = Math.hypot(mx, mz);
  if (turn && hero.dash <= 0) hero.aim = [mx / turn, mz / turn];
  const [vx, vz] = hero.dash > 0 ? hero.aim.map((unit) => unit * pace * DASH.pace) : [mx * pace, mz * pace];
  Object.assign(hero, { x: hero.x + vx * dt, z: hero.z + vz * dt, moving: Boolean(mx || mz), hurt: Math.max(0, hero.hurt - dt), safe: Math.max(0, hero.safe - dt), dash: Math.max(0, hero.dash - dt), rest: Math.max(0, hero.rest - dt) });
  if (hero.dash > 0) burst(hero.x, 0.7, hero.z, 1, GOLD, 1.5);
  hero.dust -= hero.moving ? dt : 0;
  if (hero.dust < 0) {
    hero.dust = 0.18;
    game.sparks.push({ x: hero.x - hero.aim[0] * 0.25, y: 0.12, z: hero.z + 0.1, vx: -hero.aim[0], vy: 1.4, vz: -hero.aim[1], life: 0.8, fade: 2, size: 0.5, color: DUST });
  }
  if (Math.abs(mx) > 0.1) hero.face = Math.sign(mx);
  if (hero.moving) hero.step += dt;
  const edge = Math.hypot(hero.x, hero.z) / ARENA.radius;
  if (edge > 1) Object.assign(hero, { x: hero.x / edge, z: hero.z / edge });
  const blocks = stage.obstacles.filter((block) => Math.abs(block.x - hero.x) < 24 && Math.abs(block.z - hero.z) < 20);
  shove(hero, 0.35, blocks);

  clocks.spawn += dt * (1.3 + game.time * 0.052);
  Array.from({ length: Math.max(0, Math.min(Math.floor(clocks.spawn), 230 - foes.length)) }).forEach(() => spawn());
  clocks.spawn %= 1;
  clocks.elite -= dt;
  if (clocks.elite <= 0) {
    clocks.elite = 45;
    spawn({ tier: 1 });
    tone(70, { type: 'sawtooth', dur: 0.6, vol: 0.07, slide: 0.7 });
  }
  clocks.omen -= dt;
  if (clocks.omen <= 0) {
    const [text, summon] = OMENS[game.time < FOES.bat.from ? 0 : game.omens % OMENS.length];
    Object.assign(game, { omens: game.omens + 1 });
    clocks.omen = 38;
    summon();
    omen(text);
  }
  if (!game.king && game.time > ARENA.night - 75) {
    game.king = true;
    spawn({ tier: 2, kind: FOES.knight });
    omen('The Hollow King wakes');
  }

  foes.forEach((foe) => {
    const d = gap(hero, foe) || 1;
    const [ux, uz] = [(hero.x - foe.x) / d, (hero.z - foe.z) / d];
    const weave = foe.kind.flies ? Math.sin(game.time * 4 + foe.seed) * 0.9 : 0;
    const fade = Math.exp(-dt * 7);
    Object.assign(foe, {
      x: foe.x + ((ux - uz * weave) * foe.kind.speed + foe.kx) * dt,
      z: foe.z + ((uz + ux * weave) * foe.kind.speed + foe.kz) * dt,
      kx: foe.kx * fade,
      kz: foe.kz * fade,
      flash: Math.max(0, foe.flash - dt),
      ward: foe.ward - dt,
      age: foe.age + dt,
    });
    if (d > 30) Object.assign(foe, { x: hero.x - ux * 18, z: hero.z - uz * 15 });
    if (!foe.kind.flies) shove(foe, foe.r * 0.7, blocks);
    if (d < foe.r + 0.35 && hero.hurt <= 0 && hero.safe <= 0 && hero.dash <= 0 && hero.hp > 0) wound(Math.round(foe.kind.hit * (foe.elite ? 1.5 : 1)));
  });
  foes.forEach((a, i) => foes.forEach((b, j) => {
    if (j <= i) return;
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const min = (a.r + b.r) * 0.85;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min || d2 === 0) return;
    const d = Math.sqrt(d2);
    const part = ((min - d) / d) * 0.5;
    Object.assign(a, { x: a.x - dx * part, z: a.z - dz * part });
    Object.assign(b, { x: b.x + dx * part, z: b.z + dz * part });
  }));

  clocks.bolt -= dt;
  if (clocks.bolt <= 0) {
    const arm = ARMS.bolt(rank('bolt'));
    const marks = foes.map((foe) => [gap(foe, hero), foe]).filter(([d]) => d < 10).sort(([a], [b]) => a - b).slice(0, arm.count);
    if (marks.length) {
      clocks.bolt = arm.every * quick;
      marks.forEach(([d, foe]) => game.shots.push({ x: hero.x, z: hero.z, vx: ((foe.x - hero.x) / d) * 15, vz: ((foe.z - hero.z) / d) * 15, life: 1, hit: arm.hit, pierce: arm.pierce, seen: new Set() }));
      tone(700, { dur: 0.07, vol: 0.02, slide: 0.5 });
    }
  }
  game.shots.forEach((shot) => {
    Object.assign(shot, { x: shot.x + shot.vx * dt, z: shot.z + shot.vz * dt, life: shot.life - dt });
    const foe = foes.find((other) => other.hp > 0 && !shot.seen.has(other) && gap(other, shot) < other.r + 0.4);
    if (!foe) return;
    shot.seen.add(foe);
    strike(foe, shot.hit, shot.vx * 0.3, shot.vz * 0.3);
    burst(shot.x, 0.8, shot.z, 3, GOLD, 2.5);
    Object.assign(shot, { pierce: shot.pierce - 1, life: shot.pierce > 0 ? shot.life : 0 });
  });

  wardFlames().forEach((flame) => foes.forEach((foe) => {
    const d = gap(foe, flame);
    if (foe.ward > 0 || d > foe.r + 0.55) return;
    foe.ward = 0.4;
    strike(foe, flame.hit, ((foe.x - hero.x) / (gap(foe, hero) || 1)) * 4, ((foe.z - hero.z) / (gap(foe, hero) || 1)) * 4);
  }));

  clocks.lance -= dt;
  if (rank('lance') && clocks.lance <= 0 && foes.length) {
    const arm = ARMS.lance(rank('lance'));
    const [ux, uz] = hero.aim;
    clocks.lance = arm.every * quick;
    game.beams.push({ x: hero.x, z: hero.z, ux, uz, reach: arm.reach, t: 1 });
    foes.forEach((foe) => {
      const [dx, dz] = [foe.x - hero.x, foe.z - hero.z];
      const along = dx * ux + dz * uz;
      if (along < 0 || along > arm.reach || Math.abs(dx * uz - dz * ux) > 0.8 + foe.r) return;
      strike(foe, arm.hit, ux * 7, uz * 7);
    });
    tone(880, { type: 'sine', dur: 0.2, vol: 0.05, slide: 0.5 });
  }
  game.beams.forEach((beam) => Object.assign(beam, { t: beam.t - dt * 4 }));
  game.husks.forEach((husk) => Object.assign(husk, { t: husk.t + dt * 4.5 }));

  clocks.star -= dt;
  if (rank('star') && clocks.star <= 0) {
    const arm = ARMS.star(rank('star'));
    const marks = foes.filter((foe) => gap(foe, hero) < 10).map((foe) => [Math.random(), foe]).sort(([a], [b]) => a - b).slice(0, arm.count);
    if (marks.length) clocks.star = arm.every * quick;
    marks.forEach(([, foe]) => game.stars.push({ x: foe.x, z: foe.z, t: 0.45, reach: arm.reach, hit: arm.hit }));
  }
  game.stars.forEach((star) => {
    Object.assign(star, { t: star.t - dt });
    if (star.t > 0) return;
    foes.forEach((foe) => {
      const d = gap(foe, star) || 1;
      if (d < star.reach + foe.r) strike(foe, star.hit, ((foe.x - star.x) / d) * 6, ((foe.z - star.z) / d) * 6);
    });
    stage.flash(star.x, star.z, calm ? 8 : 16);
    game.shake = Math.max(game.shake, 0.3);
    burst(star.x, 0.3, star.z, 10, FROST, 6);
    tone(95, { type: 'sawtooth', dur: 0.25, vol: 0.06, slide: 0.4 });
    ui.freeze = calm ? 0 : 0.04;
  });

  clocks.nova -= dt;
  if (rank('nova') && clocks.nova <= 0) {
    const arm = ARMS.nova(rank('nova'));
    if (foes.some((foe) => gap(foe, hero) < arm.reach)) {
      clocks.nova = arm.every * quick;
      game.rings.push({ x: hero.x, z: hero.z, t: 0, reach: arm.reach, hit: arm.hit, id: game.time });
      chord([330, 660], { type: 'sine', dur: 0.5, vol: 0.06 });
    }
  }
  game.rings.forEach((ring) => {
    Object.assign(ring, { t: ring.t + dt / 0.4 });
    foes.forEach((foe) => {
      const d = gap(foe, ring) || 1;
      if (foe.ring === ring.id || d > ring.reach * Math.min(1, ring.t)) return;
      Object.assign(foe, { ring: ring.id });
      strike(foe, ring.hit, ((foe.x - ring.x) / d) * 12, ((foe.z - ring.z) / d) * 12);
    });
  });

  const reach = 3.2 * (1 + 0.25 * rank('wick'));
  game.streak = Math.max(0, game.streak - dt * 3);
  game.embers.forEach((ember) => {
    const d = gap(hero, ember) || 1;
    Object.assign(ember, { age: ember.age + dt });
    if (d < reach || ember.pull) Object.assign(ember, { pull: Math.min(ember.pull + dt * 30, 20) });
    Object.assign(ember, { x: ember.x + ((hero.x - ember.x) / d) * ember.pull * dt, z: ember.z + ((hero.z - ember.z) / d) * ember.pull * dt });
    if (d > 0.55) return;
    Object.assign(ember, { got: true });
    hero.xp += ember.xp;
    game.streak = Math.min(game.streak + 1, 16);
    tone(520 * 2 ** (Math.floor(game.streak) / 12), { dur: 0.06, vol: 0.03 });
  });
  game.finds.forEach((find) => {
    if (gap(hero, find) > 0.95) return;
    Object.assign(find, { got: true });
    chord([659, 880], { dur: 0.18, vol: 0.05 });
    if (find.kind === 'lode') { game.embers.forEach((ember) => Object.assign(ember, { pull: 20 })); return; }
    hero.hp = Math.min(hero.max, hero.hp + 25);
    pop(hero.x, 2, hero.z, '+25', 'mend');
  });
  game.sparks.forEach((spark) => Object.assign(spark, { x: spark.x + spark.vx * dt, y: Math.max(0.05, spark.y + spark.vy * dt), z: spark.z + spark.vz * dt, vy: spark.vy - 9 * dt, life: spark.life - spark.fade * dt }));

  Object.assign(game, {
    foes: foes.filter((foe) => foe.hp > 0),
    shots: game.shots.filter((shot) => shot.life > 0),
    stars: game.stars.filter((star) => star.t > 0),
    rings: game.rings.filter((ring) => ring.t < 1),
    embers: game.embers.filter((ember) => !ember.got),
    finds: game.finds.filter((find) => !find.got),
    beams: game.beams.filter((beam) => beam.t > 0),
    husks: game.husks.filter((husk) => husk.t < 1),
    sparks: game.sparks.filter((spark) => spark.life > 0),
  });
  if (ui.mode !== 'play') return;
  if (game.time >= ARENA.night) end('dawn');
  else if (hero.xp >= xpFor(hero.level)) levelUp();
};

const draw = () => {
  const { hero } = game;
  const wick = 1 + 0.25 * rank('wick');
  const blink = ui.mode === 'play' && hero.hurt > 0 && Math.floor(hero.hurt * 18) % 2 === 0;
  const stride = hero.moving && ui.mode === 'play';
  const bounce = stride ? Math.abs(Math.sin(hero.step * 9 * Math.PI * 0.5)) * 0.08 : 0;
  const stretch = hero.dash > 0 ? 1.35 : 1;
  const stand = (1.75 * (1 + 0.015 * Math.sin(ui.clock * 2.4)) * (0.55 + 0.45 * ui.lamp)) / stretch;
  stage.sprite('hero', stride ? Math.floor(hero.step * 9) : 0, hero.x, bounce, hero.z, stand, { flip: hero.face, flash: blink ? 0.45 : 0, wide: stretch * (1.5 - 0.5 * ui.lamp) });
  stage.spark(hero.x + 0.55 * hero.face, 0.55 + bounce, hero.z + 0.1, 1.5, GOLD, (0.6 + 0.1 * Math.sin(ui.clock * 9)) * ui.lamp);
  stage.spark(hero.x, 0.04, hero.z, 3.2 * wick * 2, GOLD, 0.4 * ui.lamp, { flat: 1, ring: 0.03 });
  game.foes.forEach((foe) => {
    const rise = Math.min(1, foe.age * 3);
    const grow = rise * (1 + 0.4 * Math.sin(rise * Math.PI));
    const squash = foe.flash > 0 ? 0.84 : 1 + 0.05 * Math.sin(ui.clock * 6 + foe.seed);
    const beat = ui.clock * (foe.kind.flies ? 5 : 3) + foe.seed;
    const lift = foe.kind.flies ? 0.9 + Math.sin(beat) * 0.15 : foe.kind === FOES.wisp ? 0.14 + Math.sin(beat) * 0.1 : Math.abs(Math.sin(beat * foe.kind.speed)) * 0.09;
    stage.sprite(foe.kind.sprite, Math.floor(ui.clock * 5 + foe.seed), foe.x, lift, foe.z, foe.size * grow * squash, { flip: foe.x < hero.x ? 1 : -1, flash: foe.flash > 0 ? 1 : 0, lit: foe.elite ? 0.25 : 0, wide: 1 / squash });
    if (foe.elite) stage.spark(foe.x, 0.05, foe.z, foe.size * 1.6, VIOLET, 0.9, { flat: 1, soft: 1.5 });
  });
  game.husks.forEach((husk) => stage.sprite(husk.sprite, 0, husk.x, husk.y + husk.t * 0.7, husk.z, husk.size * (1 + husk.t * 0.7), { flip: husk.flip, flash: 1, wide: (1 - husk.t) ** 2 }));
  game.finds.forEach((find) => {
    const lift = 0.2 + Math.abs(Math.sin(ui.clock * 2.5 + find.seed)) * 0.25;
    stage.sprite(find.kind, 0, find.x, lift, find.z, 0.7, { lit: 0.55 });
    stage.spark(find.x, lift + 0.35, find.z, 1.6, find.kind === 'heart' ? ROSE : FROST, 0.5);
  });
  game.beams.forEach((beam) => Array.from({ length: Math.ceil(beam.reach * 1.6) }, (_, i) => stage.spark(beam.x + beam.ux * (0.8 + i / 1.6), 0.8, beam.z + beam.uz * (0.8 + i / 1.6), 1.5, DAWN, beam.t * 1.4, { soft: 1.6 })));
  game.embers.forEach((ember) => stage.sprite('ember', 0, ember.x, 0.12 + Math.abs(Math.sin(ui.clock * 3 + ember.seed)) * 0.12 + Math.sin(Math.min(1, ember.age / 0.4) * Math.PI) * 0.6, ember.z, ember.big ? 0.8 : 0.42, { lit: 1 }));
  game.shots.forEach((shot) => {
    stage.spark(shot.x, 0.8, shot.z, 1.1, GOLD, 1.6, { soft: 2.5 });
    stage.spark(shot.x - shot.vx * 0.03, 0.8, shot.z - shot.vz * 0.03, 0.7, GOLD, 0.7);
  });
  wardFlames().forEach((flame, i) => {
    stage.sprite('flame', 0, flame.x, 0.45, flame.z, 0.8, { flip: Math.sin(ui.clock * 8 + i) > 0 ? 1 : -1, lit: 1 });
    stage.spark(flame.x, 0.8, flame.z, 1.5, GOLD, 0.6);
  });
  game.stars.forEach((star) => {
    stage.spark(star.x, 0.05, star.z, star.reach * 2, FROST, 0.9, { flat: 1, ring: 0.06 });
    stage.spark(star.x - star.t * 4, 0.6 + star.t * 26, star.z, 1.6, FROST, 2.2, { soft: 3 });
  });
  game.rings.forEach((ring) => stage.spark(ring.x, 0.06, ring.z, ring.reach * 2 * Math.min(1, ring.t), FROST, 2.2 * (1 - ring.t), { flat: 1, ring: 0.1 }));
  game.sparks.forEach((spark) => stage.spark(spark.x, spark.y, spark.z, spark.size, spark.color, spark.life * 1.6));
  return wick;
};

const show = (key, value, apply) => {
  if (ui.shown[key] === value) return;
  ui.shown[key] = value;
  apply(value);
};
const hud = () => {
  const { hero } = game;
  show('xp', Math.round((hero.xp / xpFor(hero.level)) * 100), (value) => {
    $('xp').firstElementChild.style.transform = `scaleX(${Math.min(1, value / 100)})`;
    $('xp').setAttribute('aria-valuenow', value);
  });
  show('hp', Math.max(0, Math.round((hero.hp / hero.max) * 100)), (value) => {
    $('hp').firstElementChild.style.transform = `scaleX(${value / 100})`;
    $('hp').setAttribute('aria-valuenow', value);
  });
  show('level', hero.level, (value) => { $('level').textContent = value; });
  show('kills', game.kills, (value) => { $('kills').textContent = value; });
  show('dawn', clock(Math.max(0, ARENA.night - game.time)), (value) => { $('dawn').textContent = value; });
  const low = hero.hp < hero.max * 0.35 ? 0.3 + 0.2 * Math.sin(ui.clock * 6) : 0;
  show('veil', ui.mode === 'title' ? 0 : Math.round(Math.max(hero.hurt * 0.8, low, (1 - ui.lamp) * 0.5) * 20), (value) => { $('veil').style.opacity = value / 20; });
  show('dash', Math.round((1 - hero.rest / DASH.rest) * 40), (value) => $('dash').style.setProperty('--ready', value / 40));
  show('kit', JSON.stringify(game.boons), () => {
    $('kit').innerHTML = BOONS.filter((boon) => rank(boon.id)).map((boon) => `<li title="${boon.name}"><svg><use href="#i-${boon.id}"/></svg>${rank(boon.id)}</li>`).join('');
  });
};

const frame = (now) => {
  const dt = Math.min(0.05, Math.max(0, now - ui.last) / 1000);
  ui.last = now;
  ui.clock += dt;
  ui.freeze -= dt;
  if (ui.mode === 'play' && ui.freeze <= 0) update(dt);
  if (ui.mode === 'dying') {
    update(dt * 0.25);
    Object.assign(ui, { dying: ui.dying - dt, lamp: Math.max(0, (ui.dying - 0.3) / 1.1) });
    if (ui.dying <= 0) end('fallen');
  }
  game.shake = Math.max(0, game.shake - dt * 2.4);
  const wick = draw();
  const lead = ui.mode === 'title' ? [Math.sin(ui.clock * 0.2) * 1.4, 0] : game.hero.aim.map((unit) => (game.hero.moving && ui.mode === 'play' ? unit * 1.3 : 0));
  stage.setNight(Math.min(1, game.time / ARENA.night));
  stage.render({ x: game.hero.x, z: game.hero.z, time: ui.clock, dt, shake: game.shake, wick, calm, zoom: ZOOM[ui.mode], lamp: ui.lamp, lead });
  hud();
  requestAnimationFrame(frame);
};

const mute = (muted) => {
  ui.muted = muted;
  setMuted(muted);
  store.write('lanternfall.mute', muted);
  $('mute').setAttribute('aria-pressed', muted);
  $('mute').querySelector('use').setAttribute('href', muted ? '#i-mute' : '#i-sound');
};
window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  const pick = ui.mode === 'boon' && $('boons').children[Number(event.key) - 1];
  if (pick) pick.click();
  if (event.code === 'Space' || event.code.startsWith('Shift')) dash();
  if (event.code === 'Escape' || event.code === 'KeyP') (ui.mode === 'paused' ? resume : pause)();
  if ((event.code.startsWith('Arrow') || event.code === 'Space') && ui.mode === 'play') event.preventDefault();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); pause(); });
document.addEventListener('visibilitychange', () => document.hidden && pause());
$('stage').addEventListener('pointerdown', (event) => {
  if (ui.mode !== 'play' || stick.id !== null) return;
  Object.assign(stick, { id: event.pointerId, ox: event.clientX, oy: event.clientY });
  $('stage').setPointerCapture(event.pointerId);
  $('stick').hidden = false;
  $('stick').style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
  $('stick').firstElementChild.style.transform = '';
});
$('stage').addEventListener('pointermove', (event) => {
  if (event.pointerId !== stick.id) return;
  const [dx, dy] = [event.clientX - stick.ox, event.clientY - stick.oy];
  const scale = Math.min(1, 48 / (Math.hypot(dx, dy) || 1));
  Object.assign(stick, { x: (dx * scale) / 48, y: (dy * scale) / 48 });
  $('stick').firstElementChild.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
});
['pointerup', 'pointercancel'].forEach((type) => $('stage').addEventListener(type, (event) => event.pointerId === stick.id && dropStick()));
$('go').addEventListener('click', () => (ui.mode === 'paused' ? resume : begin)());
$('pause').addEventListener('click', pause);
$('dash').addEventListener('click', dash);
$('mute').addEventListener('click', () => mute(!ui.muted));

mute(ui.muted);
$('stage').tabIndex = -1;
sheet('title', { eyebrow: record(), title: 'Lanternfall', text: 'The shades come when the light goes. Hold the ruin until dawn.', button: 'Light the lantern', note: HINT });
requestAnimationFrame(frame);
