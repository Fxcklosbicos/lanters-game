import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ARENA, POND, SKY } from './config.js';
import { buildAtlas, hash, paintGround, paintStone, surface } from './sprites.js';

const LAMPS = 6;
const SPRITE_VERT = `
  attribute vec4 iA;
  attribute vec4 iB;
  attribute vec4 iC;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec2 vFx;
  varying float vDepth;
  varying vec2 vRoot;
  void main() {
    vec3 p = iA.xyz + vec3(position.x * iB.x, position.y * iB.y, 0.0);
    vRoot = vec2(iA.z, iB.y);
    float gust = 0.5 + 0.5 * sin(uTime * 0.55 + iA.x * 0.16 + iA.z * 0.11);
    p.x += (sin(uTime * 1.9 + iA.x * 0.9 + iA.z * 1.3) * 0.55 + gust * gust * 1.5) * iA.w * position.y * position.y * iB.y;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vUv = iC.xy + uv * iC.zw;
    vWorld = p;
    vFx = iB.zw;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const SPRITE_FRAG = `
  uniform sampler2D map;
  uniform vec3 uAmbient;
  uniform vec4 uLamp[${LAMPS}];
  uniform vec3 uLampColor[${LAMPS}];
  uniform vec3 uFogColor;
  uniform vec2 uFog;
  uniform vec3 uHero;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec2 vFx;
  varying float vDepth;
  varying vec2 vRoot;
  void main() {
    vec4 texel = texture2D(map, vUv);
    if (texel.a < 0.5) discard;
    float ahead = vRoot.x - uHero.z;
    bool veils = vRoot.y > 2.5 && ahead > 0.3 && ahead < 6.0 && distance(vWorld.xy, vec2(uHero.x, 0.9 + ahead * 0.78)) < 1.5;
    if (veils && mod(floor(gl_FragCoord.x / 2.0) + floor(gl_FragCoord.y / 2.0), 2.0) < 0.5) discard;
    vec3 light = uAmbient;
    for (int i = 0; i < ${LAMPS}; i++) {
      float fall = max(0.0, 1.0 - distance(uLamp[i].xyz, vWorld) / uLamp[i].w);
      light += uLampColor[i] * fall * fall;
    }
    vec3 color = texel.rgb * mix(light, vec3(2.6), vFx.y);
    color = mix(color, vec3(2.2), vFx.x);
    gl_FragColor = vec4(mix(color, uFogColor, smoothstep(uFog.x, uFog.y, vDepth)), 1.0);
  }`;
const SHADOW_FRAG = `
  #include <packing>
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    if (texture2D(map, vUv).a < 0.5) discard;
    gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
  }`;
const GLOW_VERT = `
  attribute vec4 iA;
  attribute vec4 iB;
  attribute vec4 iC;
  varying vec2 vUv;
  varying vec4 vColor;
  varying vec2 vShape;
  void main() {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 q = vec2(position.x * iB.x, (position.y - 0.5) * iB.y);
    vec3 p = iA.xyz + (iA.w > 0.5 ? vec3(q.x, 0.0, q.y) : right * q.x + up * q.y);
    vUv = uv;
    vColor = vec4(iC.rgb, iB.w);
    vShape = vec2(iB.z, iC.a);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const GLOW_FRAG = `
  varying vec2 vUv;
  varying vec4 vColor;
  varying vec2 vShape;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float disc = pow(max(0.0, 1.0 - d), vShape.x);
    float ring = 1.0 - smoothstep(0.0, vShape.y, abs(d - 1.0 + vShape.y));
    gl_FragColor = vec4(vColor.rgb * vColor.a * (vShape.y > 0.0 ? ring : disc), 1.0);
  }`;
const WATER_VERT = `
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    vWorld = world.xyz;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const WATER_FRAG = `
  uniform float uTime;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform vec3 uFogColor;
  uniform vec2 uFog;
  uniform vec3 uPond;
  varying vec3 vWorld;
  varying float vDepth;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 cell = floor(vWorld.xz * 10.0);
    vec2 p = cell / 10.0;
    float shore = uPond.z - distance(p, uPond.xy) + sin(p.x * 2.3) * sin(p.y * 1.9) * 0.3;
    if (shore < 0.0) discard;
    float swell = sin(p.x * 2.6 + uTime * 0.9 + sin(p.y * 1.7 + uTime * 0.6) * 1.4);
    float band = step(0.35, swell) * 0.5 + step(0.86, swell) * 0.5;
    vec3 color = mix(vec3(0.02, 0.07, 0.10), uSky * 0.55, 0.25 + band * 0.45);
    color += uSun * step(0.992, hash(cell + floor(uTime * 5.0))) * step(0.3, swell) * 3.0;
    color = mix(color, uSky * 0.9 + 0.15, step(shore, 0.18 + 0.08 * sin(uTime * 1.5 + p.x * 4.0)));
    gl_FragColor = vec4(mix(color, uFogColor, smoothstep(uFog.x, uFog.y, vDepth)), 1.0);
  }`;
const CLOUD_FRAG = `
  uniform float uTime;
  uniform vec2 uFog;
  varying vec3 vWorld;
  varying float vDepth;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }
  void main() {
    vec2 p = vWorld.xz * 0.07 + uTime * vec2(0.035, 0.02);
    float cover = noise(p) * 0.65 + noise(p * 2.3) * 0.35;
    gl_FragColor = vec4(0.02, 0.02, 0.07, smoothstep(0.48, 0.72, cover) * 0.4 * (1.0 - smoothstep(uFog.x, uFog.y, vDepth)));
  }`;
const LENS = {
  uniforms: { tDiffuse: { value: null }, uAspect: { value: 1 }, uBlur: { value: 0.011 }, uPunch: { value: 0 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAspect;
    uniform float uBlur;
    uniform float uPunch;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float reach = smoothstep(0.13, 0.5, abs(vUv.y - 0.45)) * uBlur;
      vec3 color = vec3(0.0);
      for (int i = 0; i < 16; i++) {
        float f = float(i);
        float turn = f * 2.39996;
        color += texture2D(tDiffuse, vUv + vec2(cos(turn) / uAspect, sin(turn)) * sqrt((f + 0.5) / 16.0) * reach).rgb;
      }
      color /= 16.0;
      vec2 q = vUv - 0.5;
      vec2 split = q * (0.0025 + uPunch * 0.014);
      color.r = mix(color.r, texture2D(tDiffuse, vUv + split).r, 0.7);
      color.b = mix(color.b, texture2D(tDiffuse, vUv - split).b, 0.7);
      color *= 1.0 - dot(q, q) * 0.85;
      color += (fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.016;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(mix(vec3(luma), color, 1.14), 1.0);
    }`,
};

const makeLayer = (max, material, shadow) => {
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('uv', quad.attributes.uv);
  const [A, B, C] = ['iA', 'iB', 'iC'].map((name) => {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
    return attribute;
  });
  const mesh = Object.assign(new THREE.Mesh(geometry, material), { frustumCulled: false, castShadow: Boolean(shadow), customDepthMaterial: shadow });
  const tally = { count: 0, fixed: 0 };
  return {
    mesh,
    push: (...values) => {
      if (tally.count >= max) return;
      const i = tally.count * 4;
      A.array.set(values.slice(0, 4), i);
      B.array.set(values.slice(4, 8), i);
      C.array.set(values.slice(8, 12), i);
      tally.count += 1;
    },
    keep: () => { tally.fixed = tally.count; },
    begin: () => { tally.count = tally.fixed; },
    flush: () => {
      geometry.instanceCount = tally.count;
      [A, B, C].forEach((attribute) => Object.assign(attribute, { needsUpdate: true }));
    },
  };
};

const seeded = (seed) => {
  const state = { n: seed };
  return () => {
    state.n = (state.n + 0x6d2b79f5) | 0;
    const t = Math.imul(state.n ^ (state.n >>> 15), 1 | state.n);
    const u = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((u ^ (u >>> 14)) >>> 0) / 4294967296;
  };
};

export const createStage = (canvas) => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY[0].fog);
  scene.fog = new THREE.Fog(SKY[0].fog, 24, 46);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 140);
  const atlas = buildAtlas();
  const random = seeded(19);

  const hemi = new THREE.HemisphereLight(SKY[0].sky, SKY[0].ground, 1.1);
  const sun = new THREE.DirectionalLight(SKY[0].sun, SKY[0].power);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 80 });
  sun.shadow.bias = -0.0006;
  const lampAt = (color, reach, power) => ({ light: new THREE.PointLight(color, power, reach, 1.4), reach, power, flicker: 0 });
  const lantern = lampAt('#ffb45e', 5, 26);
  const burst = lampAt('#cfe0ff', 9, 0);
  const braziers = [[5.2, 5.2], [-5.2, 5.2], [5.2, -5.2], [-5.2, -5.2]].map(([x, z]) => {
    const lamp = lampAt('#ff8a3c', 9, 34);
    lamp.light.position.set(x, 1.9, z);
    return lamp;
  });
  const lamps = [lantern, burst, ...braziers];
  scene.add(hemi, sun, sun.target, ...lamps.map((lamp) => lamp.light));

  const uniforms = {
    map: { value: atlas.map },
    uTime: { value: 0 },
    uAmbient: { value: new THREE.Color() },
    uLamp: { value: lamps.map(() => new THREE.Vector4()) },
    uLampColor: { value: lamps.map(() => new THREE.Color()) },
    uFogColor: { value: scene.fog.color },
    uFog: { value: new THREE.Vector2(scene.fog.near, scene.fog.far) },
    uHero: { value: new THREE.Vector3() },
  };
  const solid = makeLayer(
    2600,
    new THREE.ShaderMaterial({ uniforms, vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, side: THREE.DoubleSide }),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SPRITE_VERT, fragmentShader: SHADOW_FRAG, side: THREE.DoubleSide }),
  );
  const glow = makeLayer(900, new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
  glow.mesh.renderOrder = 2;
  scene.add(solid.mesh, glow.mesh);
  const sprite = (name, frame, x, y, z, height, { flip = 1, sway = 0, flash = 0, lit = 0, wide = 1 } = {}) => {
    const cell = atlas.frames[name][frame % atlas.frames[name].length];
    solid.push(x, y, z, sway, height * cell.aspect * flip * wide, height, flash, lit, ...cell.uv);
  };
  const spark = (x, y, z, size, [r, g, b], alpha = 1, { soft = 2, flat = 0, ring = 0 } = {}) => glow.push(x, y, z, flat, size, size, soft, alpha, r, g, b, ring);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.size, ARENA.size).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: paintGround() }));
  ground.receiveShadow = true;
  const stone = new THREE.MeshLambertMaterial({ map: paintStone() });
  const obstacles = [];
  const place = (geometry, material, items) => {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const pose = new THREE.Object3D();
    items.forEach(({ x, z, w, h, d = w, turn = 0, y = 0 }, i) => {
      pose.position.set(x, y + h / 2, z);
      pose.scale.set(w, h, d);
      pose.rotation.y = turn;
      pose.updateMatrix();
      mesh.setMatrixAt(i, pose.matrix);
    });
    Object.assign(mesh, { castShadow: true, receiveShadow: true });
    scene.add(mesh);
    return mesh;
  };
  const ringOf = (count, radius, make) => Array.from({ length: count }, (_, i) => {
    const turn = (i / count) * Math.PI * 2 + 0.2;
    return make(Math.cos(turn) * radius, Math.sin(turn) * radius, i);
  });
  const pillars = [
    ...ringOf(10, 8.6, (x, z, i) => ({ x, z, w: 1.1, h: [3.6, 3.6, 1.2, 2.6, 0.8, 3.9, 3.9, 1.4, 2.8, 0.9][i] })),
    ...braziers.map(({ light }) => ({ x: light.position.x, z: light.position.z, w: 0.8, h: 1.1 })),
  ];
  const clusters = Array.from({ length: 18 }, () => {
    const turn = random() * Math.PI * 2;
    const far = 13 + random() * 18;
    return { x: Math.cos(turn) * far, z: Math.sin(turn) * far, turn: random() * Math.PI };
  }).filter(({ x, z }) => Math.hypot(x - POND.x, z - POND.z) > POND.r + 4);
  const lintels = [0, 5].flatMap((i) => Array.from({ length: 4 }, (_, n) => {
    const [a, b] = [pillars[i], pillars[i + 1]];
    const along = (n + 0.5) / 4;
    return { x: a.x + (b.x - a.x) * along, z: a.z + (b.z - a.z) * along, w: Math.hypot(b.x - a.x, b.z - a.z) / 4 + 0.3, d: 1.15, h: 0.55, y: a.h, turn: -Math.atan2(b.z - a.z, b.x - a.x) };
  }));
  const blocks = clusters.flatMap(({ x, z, turn }) => Array.from({ length: 2 + Math.floor(random() * 3) }, (_, i) => ({
    x: x + Math.cos(turn) * i * 1.5,
    z: z + Math.sin(turn) * i * 1.5,
    w: 1.5,
    d: 1,
    h: 0.6 + Math.floor(random() * 4) * 0.6,
    turn: -turn,
  })));
  place(new THREE.CylinderGeometry(0.5, 0.56, 1, 8), stone, pillars);
  place(new THREE.BoxGeometry(1, 1, 1), stone, [...blocks, ...lintels]);
  place(new THREE.CylinderGeometry(0.62, 0.36, 1, 8), new THREE.MeshLambertMaterial({ color: '#2a2530' }), braziers.map(({ light }) => ({ x: light.position.x, z: light.position.z, w: 1, h: 0.3 }))).position.y = 1.1;
  obstacles.push(...pillars.map(({ x, z }) => ({ x, z, r: 0.62 })), ...blocks.map(({ x, z }) => ({ x, z, r: 0.85 })));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(POND.r * 2 + 2, POND.r * 2 + 2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: { uTime: uniforms.uTime, uSky: { value: hemi.color }, uSun: { value: sun.color }, uFogColor: uniforms.uFogColor, uFog: uniforms.uFog, uPond: { value: new THREE.Vector3(POND.x, POND.z, POND.r) } },
  }));
  water.position.set(POND.x, 0.03, POND.z);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.size, ARENA.size).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: { uTime: uniforms.uTime, uFog: uniforms.uFog },
    transparent: true,
    depthWrite: false,
  }));
  Object.assign(clouds, { renderOrder: 1 }).position.y = 0.05;
  obstacles.push({ x: POND.x, z: POND.z, r: POND.r - 0.2 });
  scene.add(ground, water, clouds);

  const scatter = (count, min, max, keep) => Array.from({ length: count }, () => {
    const turn = random() * Math.PI * 2;
    const far = Math.sqrt(min * min + random() * (max * max - min * min));
    return { x: Math.cos(turn) * far, z: Math.sin(turn) * far, pick: Math.floor(random() * 3), size: 0.85 + random() * 0.35 };
  }).filter(({ x, z }) => keep(x, z));
  const onGrass = (x, z) => surface(x, z) === 'grass';
  const clear = (x, z) => onGrass(x, z) && obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > 2.2);
  const trees = [...scatter(46, 11, ARENA.radius, clear), ...scatter(420, ARENA.radius + 1.5, ARENA.radius + 13, () => true)];
  const rocks = scatter(34, 9, ARENA.radius, clear);
  trees.forEach(({ x, z, pick, size }) => sprite('tree', pick, x, 0, z, 4.1 * size, { sway: 0.03 }));
  rocks.forEach(({ x, z, pick, size }) => sprite('rock', pick, x, 0, z, 0.8 * size));
  scatter(900, 7, ARENA.radius + 4, onGrass).forEach(({ x, z, pick }) => sprite(pick ? 'tuft' : 'bloom', 0, x, 0, z, pick ? 0.42 : 0.5, { sway: 0.13 }));
  obstacles.push(...trees.filter(({ x, z }) => Math.hypot(x, z) < ARENA.radius).map(({ x, z }) => ({ x, z, r: 0.45 })), ...rocks.map(({ x, z }) => ({ x, z, r: 0.5 })));
  solid.keep();
  const wrap = (value, span) => (((value % span) + span) % span) - span / 2;
  const drift = (count, salt) => Array.from({ length: count }, (_, i) => ({ x: hash(i, salt) * 44, z: hash(i, salt + 1) * 30, seed: hash(i, salt + 2) * 40, pick: i % 3 }));
  const leaves = drift(40, 21);
  const mist = drift(12, 31);
  const motes = Array.from({ length: 60 }, (_, i) => ({ x: (hash(i, 1) - 0.5) * 44, z: (hash(i, 2) - 0.5) * 30, y: 0.5 + hash(i, 3) * 2.2, seed: hash(i, 4) * 40 }));

  const composer = new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.75, 0.92);
  const lens = new ShaderPass(LENS);
  [new RenderPass(scene, camera), bloom, lens, new OutputPass()].forEach((pass) => composer.addPass(pass));

  const view = { x: 0, z: 0, reach: 22, zoom: 1.7, w: 1, h: 1 };
  const sunDir = new THREE.Vector3(-0.8, 0.85, 0.3).normalize();
  const tones = SKY.map((key) => ({ ...key, sun: new THREE.Color(key.sun), sky: new THREE.Color(key.sky), ground: new THREE.Color(key.ground), fog: new THREE.Color(key.fog) }));
  const probe = new THREE.Vector3();
  const tint = new THREE.Color();

  const resize = () => {
    const [w, h] = [canvas.clientWidth, canvas.clientHeight];
    if (!w || !h || (w === view.w && h === view.h)) return;
    Object.assign(view, { w, h, reach: 22 * Math.min(1.7, Math.max(1, 1.3 / (w / h))) });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lens.uniforms.uAspect.value = w / h;
  };

  const setNight = (progress) => {
    const next = Math.max(1, tones.findIndex((key) => key.at >= progress));
    const [from, to] = [tones[next - 1], tones[next]];
    const mix = (progress - from.at) / (to.at - from.at);
    sun.color.lerpColors(from.sun, to.sun, mix);
    sun.intensity = from.power + (to.power - from.power) * mix;
    hemi.color.lerpColors(from.sky, to.sky, mix);
    hemi.groundColor.lerpColors(from.ground, to.ground, mix);
    scene.fog.color.lerpColors(from.fog, to.fog, mix);
    scene.background.copy(scene.fog.color);
    uniforms.uAmbient.value.copy(sun.color).multiplyScalar(sun.intensity * 0.16).add(tint.copy(hemi.color).multiplyScalar(0.75));
  };

  const render = ({ x, z, time, dt, shake, wick, calm, zoom = 1, lamp = 1, lead = [0, 0] }) => {
    resize();
    const ease = 1 - Math.exp(-dt * 4.5);
    view.x += (x + lead[0] - view.x) * ease;
    view.z += (z + lead[1] - view.z) * ease;
    view.zoom += (zoom - view.zoom) * (1 - Math.exp(-dt * 2.2));
    const jolt = calm ? 0 : shake;
    const reach = view.reach * view.zoom;
    camera.position.set(view.x + (Math.random() - 0.5) * jolt, reach * 0.62, view.z + reach * 0.79 + (Math.random() - 0.5) * jolt);
    lantern.power = 26 * lamp;
    uniforms.uHero.value.set(x, 0, z);
    Object.assign(lens.uniforms.uPunch, { value: jolt });
    Object.assign(lens.uniforms.uTime, { value: time });
    camera.lookAt(view.x, 0.9, view.z);
    sun.target.position.set(view.x, 0, view.z);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 40);
    lantern.reach = 5 * wick;
    lantern.light.position.set(x, 1.3, z + 0.5);
    burst.power *= Math.exp(-dt * 9);
    lamps.forEach((lamp, i) => {
      const flicker = lamp === burst ? 1 : 0.86 + 0.14 * Math.sin(time * (9 + i * 1.7) + i * 2.1) * Math.sin(time * 3.1 + i);
      Object.assign(lamp.light, { intensity: lamp.power * flicker, distance: lamp.reach });
      uniforms.uLamp.value[i].set(lamp.light.position.x, lamp.light.position.y, lamp.light.position.z, lamp.reach);
      uniforms.uLampColor.value[i].copy(lamp.light.color).multiplyScalar(lamp.power * flicker * 0.05);
    });
    braziers.forEach(({ light }, i) => {
      sprite('flame', 0, light.position.x, 1.2, light.position.z, 0.9 + 0.12 * Math.sin(time * 11 + i), { flip: Math.sin(time * 7 + i) > 0 ? 1 : -1, lit: 1 });
      spark(light.position.x, 1.7, light.position.z, 2.6, [1, 0.5, 0.18], 0.5);
      Array.from({ length: 4 }, (_, n) => {
        const rise = (time * 0.45 + n / 4 + i * 0.37) % 1;
        return spark(light.position.x + Math.sin(rise * 9 + n * 2) * 0.35, 1.5 + rise * 2.6, light.position.z, 0.16, [1, 0.6, 0.2], (1 - rise) * 1.6);
      });
    });
    leaves.forEach(({ x: lx, z: lz, seed, pick }) => sprite(pick ? 'leaf' : 'petal', 0, view.x + wrap(lx + time * 0.9 + Math.sin(time + seed) - view.x, 44), 4.6 - ((time * 0.5 + seed) % 5), view.z + wrap(lz + time * 0.3 - view.z, 30), 0.15, { flip: Math.sin(time * 3 + seed) > 0 ? 1 : -1 }));
    mist.forEach(({ x: mx, z: mz, seed }) => spark(view.x + wrap(mx + time * 0.35 - view.x, 44), 0.6, view.z + wrap(mz + Math.sin(time * 0.1 + seed) * 2 - view.z, 30), 9, [hemi.color.r, hemi.color.g, hemi.color.b], 0.04, { soft: 1.3 }));
    motes.forEach(({ x: mx, z: mz, y, seed }) => spark(view.x + wrap(mx + Math.sin(time * 0.3 + seed) * 2 - view.x, 44), y + Math.sin(time * 0.7 + seed) * 0.4, view.z + wrap(mz - view.z, 30), 0.22, [0.9, 1, 0.5], 0.5 + 0.5 * Math.sin(time * 2 + seed)));
    uniforms.uTime.value = time;
    solid.flush();
    glow.flush();
    composer.render(dt);
    solid.begin();
    glow.begin();
  };

  return {
    render,
    setNight,
    sprite,
    spark,
    obstacles,
    flash: (x, z, power) => {
      burst.light.position.set(x, 1.6, z);
      burst.power = power;
    },
    project: (x, y, z) => {
      probe.set(x, y, z).project(camera);
      return [(probe.x * 0.5 + 0.5) * view.w, (0.5 - probe.y * 0.5) * view.h];
    },
  };
};
