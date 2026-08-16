// =============================================================================
// MANDELHOP TIMEWARP — main.js
// Boot, render loop, resize, instrumentation. World systems run on the
// TIME-SCALED clock (game.worldT) so time powers bend reality while the
// frog stays responsive on raw dt.
// =============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { WaterSystem } from './water.js';
import { Vegetation } from './vegetation.js';
import { FractalWorld } from './fractals.js';
import { Effects } from './effects.js';
import { Frog } from './frog.js';
import { CameraRig } from './camera.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { TimeMagic } from './timemagic.js';
import { Flow } from './flow.js';
import { Powers } from './powers.js';
import { Collectibles } from './collect.js';
import { Trial } from './ghost.js';
import { Guardian } from './boss.js';
import { Hub } from './hub.js';
import { POWERS } from './stages.js';

const QA = new URLSearchParams(location.search).has('qa');

const canvas = document.getElementById('c');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('overlay').innerHTML =
    '<div class="panel"><div class="big">WEBGL REQUIRED</div><div class="controls">This garden needs a WebGL2 browser.</div></div>';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2a1140, 0.026);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 11, 8);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
if ('environmentIntensity' in scene) scene.environmentIntensity = 0.22;

const ui = new UI();
const audio = new AudioEngine();
const water = new WaterSystem(scene);
const veg = new Vegetation(scene);
const fractals = new FractalWorld(scene);
const effects = new Effects(scene);
const frog = new Frog(scene);
const rig = new CameraRig(camera);
const world = new World(scene);

// timewarp systems
const timemagic = new TimeMagic({ scene, audio, effects, ui, camera: rig });
const collect = new Collectibles({ scene, effects, audio, ui });
const flow = new Flow({ audio, effects, ui, veg, water });
const powers = new Powers({ scene, frog, effects, audio, ui, collect, camera: rig, water });
const trial = new Trial({ scene, ui, audio });
const guardian = new Guardian({ scene, audio, effects, ui, camera: rig });

const game = new Game({ scene, ui, audio, effects, water, veg, fractals, frog, camera: rig, world, timemagic, collect, flow, powers, trial, guardian });
window.__game = game;

const hub = new Hub({ scene, progress: game.progress, ui, audio });
game.hub = hub;
collect.onTimePod = () => { timemagic.meter = Math.min(1, timemagic.meter + 0.3); };

let showFps = false;
const input = new Input({
  onDir: (dx, dy) => game.onDir(dx, dy),
  onAction: (a) => {
    if (a === 'fps') { showFps = !showFps; ui.showFps(showFps); return; }
    game.onAction(a);
  },
});
game.input = input;

ui.bind({
  sound: () => game.onAction('mute'),
  camera: () => game.onAction('camera'),
  restart: () => game.onAction('restart'),
  exit: () => game.onAction('exit'),
  reduced: () => { ui.setReduced(!ui.reduced); ui.showTitle(game.best, { sound: !audio.muted, camera: rig.mode }); },
});

if (QA) audio.setMuted(true);

// title backdrop world
game.prepWorld();
ui.showTitle(game.best, { sound: !audio.muted, camera: rig.mode });
frog.revive(new THREE.Vector3(0, 0, 0));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
let simT = 0;
let fpsEma = 60, fpsTick = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 1 / 20);
  simT += dt;
  const t = simT;

  input.poll();
  audio.update();
  const beat = 1 - audio.beatPhase();

  game.update(t, dt);
  const wt = game.worldT;   // time-bent world clock
  water.update(wt, beat);
  veg.update(wt, beat);
  fractals.update(wt, dt, beat, camera.position, game.frog.group.position.z);
  effects.update(wt, dt);
  world.update(wt, beat, game.frog.group.position.z);
  frog.update(t, dt);
  ui.update(dt, camera);

  if (game.state === 'title' || game.state === 'gameover') {
    rig.update(t, dt, new THREE.Vector3(Math.sin(t * 0.1) * 2, 0, -5));
  }

  renderer.render(scene, camera);

  fpsEma += (1 / Math.max(dt, 1e-4) - fpsEma) * 0.05;
  if (showFps && now - fpsTick > 250) {
    fpsTick = now;
    ui.setFps(`${fpsEma.toFixed(0)} fps · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`);
  }
}
requestAnimationFrame(frame);

// QA hooks
if (QA) {
  window.__qa = {
    start: () => game.enterHub(),
    stage: (id, trial) => game.openStage(id, trial),
    endless: () => game.startEndless(),
    grant: (p) => { game.progress.grantPower(p); powers.grant(p); },
    grantAll: () => { for (const p of Object.keys(POWERS)) { game.progress.grantPower(p); powers.grant(p); } },
    teleport: (row, x = 0) => {
      // snap to nearest safe-ish row ≤ row, and grant brief invulnerability
      let r = row;
      for (let k = row; k >= Math.max(0, row - 6); k--) {
        const rw = game.rows.get(k);
        if (rw && (rw.type === 'safe' || rw.type === 'checkpoint')) { r = k; break; }
      }
      game.row = r; game.fx = x; game.respawnRow = r;
      game.frog.revive(new THREE.Vector3(x, 0, -r));
      if (game.state === 'dying') game.state = 'play';
      game._dashInvuln = 1.0;
    },
    meter: (v) => { timemagic.meter = v; },
    state: () => ({ state: game.state, mode: game.mode, row: game.row, fx: game.fx, lives: game.lives, score: game.score, pollen: collect.got, fps: Math.round(fpsEma) }),
  };
}
