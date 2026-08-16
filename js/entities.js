// =============================================================================
// MANDELHOP — entities.js
// Procedural lane entities. Vehicles evolve per world — cars → beetles →
// caterpillars → orbs → mantas — always preserving readable silhouettes:
// length = collision footprint, direction obvious from shape & glow trail.
// Platforms: logs & lily pads that bob/pitch on the water heightfield.
// =============================================================================
import * as THREE from 'three';

function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

function physMat(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial(Object.assign({
    color, roughness: 0.32, metalness: 0.1,
    clearcoat: 1.0, clearcoatRoughness: 0.22,
    iridescence: 0.55, iridescenceIOR: 1.35,
    envMapIntensity: 0.45,
  }, opts));
}

// --- VEHICLES / CREATURES -----------------------------------------------------
export function buildVehicle(style, len, theme, rng) {
  const g = new THREE.Group();
  const hue = rng.next();
  const bodyCol = hsl(theme.flowerHue + hue * 0.25 - 0.1, 0.9, 0.34);
  const glowCol = new THREE.Color(theme.accent);
  const glowMat = new THREE.MeshBasicMaterial({ color: glowCol });

  if (style === 'car') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.3, 0.72), physMat(bodyCol));
    body.position.y = 0.3;
    // rounded hood + trunk slabs for silhouette
    const hood = new THREE.Mesh(new THREE.BoxGeometry(len * 0.3, 0.2, 0.66), physMat(bodyCol));
    hood.position.set(len * 0.3, 0.48, 0);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.38, 0.24, 0.56),
      physMat(hsl(theme.vegHue2, 0.7, 0.14), { roughness: 0.08 }));
    cabin.position.set(-len * 0.08, 0.54, 0);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len * 0.94, 0.06, 0.74), glowMat);
    strip.position.y = 0.16;
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, 0.08, 0.78),
      new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.9 }));
    skirt.position.y = 0.08;
    // headlight eyes — direction readability
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, glowMat);
      e.position.set(len * 0.46, 0.3, s * 0.24);
      g.add(e);
    }
    g.add(body, hood, cabin, strip, skirt);
  } else if (style === 'beetle') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), physMat(bodyCol, { iridescence: 0.9 }));
    shell.scale.set(len * 0.52, 0.42, 0.42);
    shell.position.y = 0.32;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), physMat(hsl(theme.vegHue2, 0.8, 0.35)));
    head.position.set(len * 0.5, 0.28, 0);
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, glowMat);
      e.position.set(len * 0.62, 0.34, s * 0.1);
      g.add(e);
    }
    // glowing wing-case seams
    const seam = new THREE.Mesh(new THREE.BoxGeometry(len * 0.7, 0.02, 0.02), glowMat);
    seam.position.y = 0.55;
    g.add(shell, head, seam);
  } else if (style === 'caterpillar') {
    const n = Math.max(3, Math.round(len * 2.2));
    for (let i = 0; i < n; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10),
        physMat(hsl(theme.flowerHue + i * 0.035, 0.85, 0.55)));
      seg.position.set(-len / 2 + (i + 0.5) * (len / n), 0.32, 0);
      seg.userData.segIdx = i;
      g.add(seg);
      if (i === n - 1) {
        const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
        for (const s of [-1, 1]) {
          const e = new THREE.Mesh(eyeGeo, glowMat);
          e.position.set(seg.position.x + 0.24, 0.42, s * 0.12);
          g.add(e);
        }
      }
    }
  } else if (style === 'orb') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1),
      physMat(bodyCol, { emissive: bodyCol, emissiveIntensity: 0.4, iridescence: 1.0 }));
    core.position.y = 0.38;
    core.userData.spin = true;
    g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 24), glowMat);
    ring.position.y = 0.38;
    ring.rotation.x = Math.PI / 2.4;
    ring.userData.spinRing = true;
    g.add(ring);
    if (len > 1.5) {
      const core2 = core.clone();
      core2.position.set(-len * 0.4, 0.34, 0);
      core2.scale.setScalar(0.75);
      g.add(core2);
    }
  } else { // manta — cosmic recursive organism
    const geo = new THREE.ConeGeometry(0.5, len * 0.9, 4, 1);
    geo.rotateZ(-Math.PI / 2);
    geo.scale(1, 0.35, 1.6);
    const body = new THREE.Mesh(geo, physMat(bodyCol, { iridescence: 1.0, roughness: 0.2 }));
    body.position.y = 0.34;
    body.userData.flap = true;
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, glowMat);
      e.position.set(len * 0.32, 0.36, s * 0.14);
      g.add(e);
    }
    g.add(body);
  }

  // soft glow trail marker (readability of direction)
  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(len * 0.8, 0.5),
    new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.14, depthWrite: false })
  );
  trail.rotation.x = -Math.PI / 2;
  trail.position.set(-len * 0.28, 0.03, 0);
  g.add(trail);

  g.userData.len = len;
  return g;
}

// Per-frame flavor animation for vehicles (squirm, spin, flap)
export function animateVehicle(g, t, speed) {
  for (const c of g.children) {
    if (c.userData.segIdx !== undefined) {
      c.position.y = 0.32 + Math.sin(t * 6 + c.userData.segIdx * 1.2) * 0.05;
      c.position.z = Math.sin(t * 4 + c.userData.segIdx * 0.9) * 0.06;
    }
    if (c.userData.spin) { c.rotation.y = t * 2; c.rotation.x = t * 1.3; }
    if (c.userData.spinRing) { c.rotation.z = t * 3; }
    if (c.userData.flap) { c.scale.y = 0.35 + Math.abs(Math.sin(t * 5)) * 0.25; }
  }
}

// --- PLATFORMS ----------------------------------------------------------------
export function buildPlatform(kind, len, theme, rng, sinker = false) {
  const g = new THREE.Group();
  if (kind === 'log') {
    const geo = new THREE.CylinderGeometry(0.34, 0.34, len, 10, 1);
    geo.rotateZ(Math.PI / 2);
    const log = new THREE.Mesh(geo, physMat(hsl(0.07, 0.55, 0.22), {
      roughness: 0.75, clearcoat: 0.4, iridescence: 0.2,
    }));
    // mossy glowing top strip
    const moss = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, len * 0.96, 10, 1, true, -0.7, 1.4),
      new THREE.MeshStandardMaterial({
        color: hsl(theme.vegHue, 0.8, 0.4), roughness: 0.9,
        emissive: hsl(theme.vegHue, 0.9, 0.25), emissiveIntensity: 0.6,
      }));
    moss.geometry.rotateZ(Math.PI / 2);
    g.add(log, moss);
    // end rings
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10),
        new THREE.MeshStandardMaterial({ color: hsl(0.09, 0.5, 0.42), roughness: 0.9 }));
      cap.position.set(s * len / 2, 0, 0);
      cap.rotation.y = s * Math.PI / 2;
      g.add(cap);
    }
  } else {
    // lily pad — circle with a notch, jewel veins
    const shape = new THREE.Shape();
    const R = len * 0.46;
    const notch = 0.5;
    shape.absarc(0, 0, R, notch / 2, Math.PI * 2 - notch / 2, false);
    shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape, 24);
    geo.rotateX(-Math.PI / 2);
    const pad = new THREE.Mesh(geo, physMat(sinker ? hsl(theme.vegHue + 0.06, 0.7, 0.16) : hsl(theme.vegHue + 0.06, 0.85, 0.26), {
      roughness: 0.45, clearcoat: 0.8,
    }));
    pad.material.side = THREE.DoubleSide;
    g.add(pad);
    const veinMat = new THREE.MeshBasicMaterial({ color: sinker ? 0xff3355 : hsl(theme.vegHue2, 0.9, 0.6), transparent: true, opacity: 0.6 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      const vein = new THREE.Mesh(new THREE.BoxGeometry(R * 0.85, 0.012, 0.02), veinMat);
      vein.position.set(Math.cos(a) * R * 0.42, 0.015, Math.sin(a) * R * 0.42);
      vein.rotation.y = -a;
      g.add(vein);
    }
    // a small blossom on some pads
    if (rng.chance(0.6)) {
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue, 0.95, 0.7) }));
      bl.position.set(R * 0.3, 0.06, R * 0.2);
      g.add(bl);
    }
  }
  g.userData.len = len;
  g.userData.kind = kind;
  g.userData.sinker = sinker;
  return g;
}

// Bob & pitch platforms on the water heightfield. Visual only.
// dip: extra sink when the frog stands on it (weight feedback).
export function posePlatform(g, x, z, water, t, dip = 0) {
  const L = g.userData.len;
  const hC = water.heightAt(x, z, t);
  const hL = water.heightAt(x - L * 0.4, z, t);
  const hR = water.heightAt(x + L * 0.4, z, t);
  const hF = water.heightAt(x, z - 0.4, t);
  const hB = water.heightAt(x, z + 0.4, t);
  g.position.y = 0.12 + hC - dip;
  g.rotation.z = Math.atan2(hL - hR, L * 0.8) * 0.9;
  g.rotation.x = Math.atan2(hB - hF, 0.8) * 0.9;
  if (g.userData.kind === 'lily') {
    g.rotation.y = Math.sin(t * 0.4 + x) * 0.15;
    const flex = 1 - dip * 0.6;
    g.scale.set(flex, 1, flex);
  }
}

// =============================================================================
// THE DESCENT — predators, hazards, structures
// =============================================================================

// --- DRAGONFLY HUNTER: stalks the frog, telegraphs, then dashes across its row
export function buildDragonfly(theme) {
  const g = new THREE.Group();
  const bodyMat = physMat(hsl(theme.vegHue2, 0.85, 0.4), { iridescence: 1.0, roughness: 0.15 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bodyMat);
  head.position.set(0.36, 0.5, 0);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2255 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat);
    e.position.set(0.44, 0.54, s * 0.09);
    g.add(e);
  }
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0xcceeff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const wings = [];
  for (const s of [-1, 1]) {
    for (const off of [-0.08, 0.1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.72), wingMat);
      w.position.set(off, 0.56, s * 0.3);
      w.rotation.x = s * 0.5;
      g.add(w); wings.push(w);
    }
  }
  g.add(body, head);
  g.userData.wings = wings;
  g.userData.glowMat = glowMat;
  g.visible = false;
  return g;
}

export function animateDragonfly(g, t, flapSpeed = 40) {
  for (let i = 0; i < g.userData.wings.length; i++) {
    const w = g.userData.wings[i];
    w.rotation.y = Math.sin(t * flapSpeed + i) * 0.7;
  }
}

// --- SNAKE: patrols a safe row on a sine path ---------------------------------
export function buildSnake(theme, rng) {
  const g = new THREE.Group();
  const mat = physMat(hsl(theme.flowerHue + 0.1, 0.9, 0.35), { iridescence: 0.8 });
  const segs = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16 - i * 0.012, 10, 8), mat);
    segs.push(s); g.add(s);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowMat);
    e.position.set(0.16, 0.08, sd * 0.08);
    segs[0].add(e);
  }
  g.userData.segs = segs;
  return g;
}

export function animateSnake(g, t) {
  const segs = g.userData.segs;
  for (let i = 0; i < segs.length; i++) {
    segs[i].position.set(-i * 0.24, 0.16 + Math.sin(t * 7 - i * 0.9) * 0.03, Math.sin(t * 5 - i * 0.8) * 0.14);
  }
}

// --- CHOMPER: carnivorous bloom; open → SNAP cycle ------------------------------
export function buildChomper(theme, rng) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: hsl(theme.vegHue, 0.7, 0.25), roughness: 0.8 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 6), stemMat);
  stem.position.y = 0.2;
  g.add(stem);
  const jawMat = physMat(hsl(0.98, 0.9, 0.4), { iridescence: 0.7 });
  const mouth = new THREE.MeshBasicMaterial({ color: 0xff2266 });
  const jawT = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 8), jawMat);
  jawT.position.y = 0.55;
  const jawB = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 8), jawMat);
  jawB.rotation.x = Math.PI;
  jawB.position.y = 0.55;
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mouth);
  throat.position.y = 0.5;
  g.add(jawT, jawB, throat);
  g.userData = { jawT, jawB, phase: rng ? rng.range(0, 2.6) : 0 };
  return g;
}

// open01: 0 closed → 1 fully open
export function animateChomper(g, open01) {
  const { jawT, jawB } = g.userData;
  const a = open01 * 0.85 + 0.08;
  jawT.rotation.x = -a;
  jawB.rotation.x = Math.PI + a;
  jawT.position.z = -Math.sin(a) * 0.2;
  jawB.position.z = -Math.sin(a) * 0.2;
}

// --- POLLEN ORB: energy pickup ---------------------------------------------------
export function buildOrb(theme) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1),
    new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue, 1.0, 0.75) }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue, 1.0, 0.6), transparent: true, opacity: 0.25, depthWrite: false }));
  g.add(core, halo);
  g.userData.core = core;
  return g;
}

// --- CHECKPOINT MANDALA -----------------------------------------------------------
export function buildCheckpoint(theme) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  const beamMat = new THREE.MeshBasicMaterial({
    color: theme.accent, transparent: true, opacity: 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.4, 2.6, 14, 1, true), beamMat);
  beam.position.y = 1.3;
  g.add(beam);
  const lotusMat = new THREE.MeshStandardMaterial({
    color: hsl(theme.flowerHue, 0.85, 0.62), emissive: hsl(theme.flowerHue, 0.85, 0.4),
    emissiveIntensity: 0.8, roughness: 0.4,
  });
  const lotus = new THREE.Group();
  for (let p = 0; p < 8; p++) {
    const petal = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), lotusMat);
    const a = (p / 8) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14);
    petal.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    lotus.add(petal);
  }
  lotus.scale.setScalar(0.001);
  g.add(lotus);
  g.userData = { ring, beam, lotus, ringMat };
  return g;
}

// --- WORMHOLE PAIR RING -------------------------------------------------------------
export function buildWormhole(theme, hue) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: hsl(hue, 1, 0.65) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 32), mat);
  ring.position.y = 0.5;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24),
    new THREE.MeshBasicMaterial({ color: hsl(hue, 1, 0.4), transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.position.y = 0.5;
  g.add(ring, disc);
  g.userData = { ring, disc };
  return g;
}

// =============================================================================
// TIMEWARP EXPANSION — temporal pods, collectibles, guardians, time objects
// =============================================================================

// --- CHRONOPODS ----------------------------------------------------------------
// variants: normal, time, bounce, armored, spore, countdown, phase, quantum,
//           musical, heavy, grapple, dash, seedTarget
export function buildChronopod(variant, theme, rng) {
  const g = new THREE.Group();
  const hueMap = {
    normal: theme.flowerHue, time: 0.13, bounce: 0.32, armored: 0.6,
    spore: 0.02, countdown: 0.75, phase: 0.5, quantum: 0.85,
    musical: 0.55, heavy: 0.0, grapple: 0.4, dash: 0.68, seedTarget: 0.22,
  };
  const hue = (hueMap[variant] ?? theme.flowerHue);
  const shell = physMat(hsl(hue, 0.85, variant === 'heavy' ? 0.18 : 0.35), {
    roughness: variant === 'armored' || variant === 'heavy' ? 0.55 : 0.25,
    metalness: variant === 'armored' || variant === 'heavy' ? 0.6 : 0.05,
  });
  // seed-pod body: faceted sphere with a sprout seam
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), shell);
  body.position.y = 0.32;
  body.scale.set(1, 1.15, 1);
  g.add(body);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 24),
    new THREE.MeshBasicMaterial({ color: hsl(hue + 0.08, 1, 0.7) }));
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 0.32;
  g.add(seam);
  // sprout
  const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5),
    new THREE.MeshStandardMaterial({ color: hsl(theme.vegHue, 0.8, 0.4), roughness: 0.7, emissive: hsl(theme.vegHue, 0.8, 0.2), emissiveIntensity: 0.7 }));
  sprout.position.y = 0.66;
  g.add(sprout);

  if (variant === 'armored' || variant === 'heavy') {
    const bands = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.9 }));
    bands.rotation.x = Math.PI / 2; bands.position.y = 0.32;
    g.add(bands);
    if (variant === 'heavy') {
      const b2 = bands.clone(); b2.rotation.z = Math.PI / 2; g.add(b2);
    }
  }
  if (variant === 'time' || variant === 'countdown') {
    // little hourglass halo
    const hg = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9 }));
    hg.position.y = 0.85; hg.userData.spinSlow = true;
    g.add(hg);
  }
  if (variant === 'quantum') {
    body.material.transparent = true; body.material.opacity = 0.45;
    seam.material.transparent = true; seam.material.opacity = 0.7;
  }
  if (variant === 'spore') {
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xff5533 }));
      const a = i * 1.7;
      w.position.set(Math.cos(a) * 0.26, 0.42 + (i % 2) * 0.12, Math.sin(a) * 0.26);
      g.add(w);
    }
  }
  g.userData = { variant, body, seam, sprout, hue };
  return g;
}

// --- TIME POLLEN (single mote — mass-instanced by collect.js) -------------------
export function buildShard(theme) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: hsl(theme.flowerHue, 0.9, 0.6), roughness: 0.05, metalness: 0.1,
    clearcoat: 1, iridescence: 1.0, iridescenceIOR: 1.8,
    emissive: hsl(theme.flowerHue, 0.9, 0.35), emissiveIntensity: 1.4,
    transparent: true, opacity: 0.95,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
  core.position.y = 0.65;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 6, 32),
    new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue + 0.1, 1, 0.7), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.y = 0.65;
  g.add(core, ring);
  g.userData = { core, ring };
  return g;
}

export function buildGlyph(theme) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xbaf7ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.3, 6), mat);
  plate.position.y = 0.8;
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  inner.position.y = 0.8;
  g.add(plate, inner);
  g.userData = { plate, inner };
  return g;
}

// --- TEMPORAL PORTAL (stage exit) ------------------------------------------------
export function buildPortal(theme) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshPhysicalMaterial({
    color: hsl(theme.flowerHue, 0.9, 0.5), emissive: hsl(theme.flowerHue, 1, 0.4),
    emissiveIntensity: 2.2, roughness: 0.2, clearcoat: 1, iridescence: 0.8,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 10, 48), ringMat);
  ring.position.y = 1.5;
  // swirling disc
  const discMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color(theme.accent) }, uB: { value: hsl(theme.flowerHue, 1, 0.6) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uA, uB; varying vec2 vUv;
      void main(){
        float r = length(vUv); if (r>1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float sw = sin(a*5.0 - uTime*4.0 + r*9.0)*0.5+0.5;
        float sw2 = sin(a*11.0 + uTime*2.5 - r*16.0)*0.5+0.5;
        vec3 col = mix(uA, uB, sw) + uB*sw2*0.5;
        float alpha = smoothstep(1.0,0.85,r) * (0.35+0.65*sw) ;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), discMat);
  disc.position.y = 1.5;
  // petal crown
  const petals = new THREE.Group();
  const pm = new THREE.MeshStandardMaterial({ color: hsl(theme.flowerHue, 0.85, 0.6), emissive: hsl(theme.flowerHue, 0.9, 0.35), emissiveIntensity: 1.2, roughness: 0.4 });
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.55, 5), pm);
    const a = (i / 12) * Math.PI * 2;
    p.position.set(Math.cos(a) * 1.38, 1.5 + Math.sin(a) * 1.38, 0);
    p.rotation.z = -a - Math.PI / 2;
    petals.add(p);
  }
  g.add(ring, disc, petals);
  g.userData = { ring, disc, discMat, petals };
  return g;
}

// --- BONUS PORTAL (Mandelbrot pocket) ---------------------------------------------
export function buildBonusPortal(theme) {
  const g = buildWormhole(theme, 0.78);
  g.userData.ring.scale.setScalar(1.5);
  g.userData.disc.scale.setScalar(1.5);
  g.userData.ring.position.y = 0.8;
  g.userData.disc.position.y = 0.8;
  return g;
}

// --- GUARDIAN: giant temporal heron (template; themed per world) -------------------
export function buildGuardian(theme, scale = 3.2) {
  const g = new THREE.Group();
  const bodyMat = physMat(hsl(theme.vegHue2, 0.75, 0.28), { iridescence: 1.0, roughness: 0.25 });
  const glowMat = new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue, 1, 0.65) });
  const darkMat = physMat(hsl(theme.vegHue2, 0.7, 0.14), { roughness: 0.5 });
  const featherMat = physMat(hsl(theme.vegHue2 + 0.06, 0.85, 0.42), { iridescence: 0.9, roughness: 0.3 });

  // sleek horizontal body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), bodyMat);
  body.scale.set(0.85, 0.72, 1.55);
  body.position.y = 1.55;
  // tail fan — three soft plumes
  for (let i = -1; i <= 1; i++) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.85, 5), featherMat);
    plume.rotation.x = Math.PI / 2 - 0.5;
    plume.rotation.y = i * 0.35;
    plume.position.set(i * 0.14, 1.6, 0.85);
    g.add(plume);
  }
  // S-curved neck (two segments)
  const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.85, 8), bodyMat);
  neck1.position.set(0, 2.05, -0.62);
  neck1.rotation.x = 0.75;
  const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8), bodyMat);
  neck2.position.set(0, 2.55, -0.72);
  neck2.rotation.x = -0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), bodyMat);
  head.scale.set(0.85, 0.8, 1.25);
  head.position.set(0, 2.88, -0.88);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 1.0, 8), darkMat);
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 2.86, -1.5);
  // crest — three temporal filaments
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.55, 5), glowMat);
    f.position.set((i - 1) * 0.06, 3.06, -0.82);
    f.rotation.x = -0.75 - i * 0.2;
    g.add(f);
  }
  // wings — swept tapered membranes, readable silhouette
  const wings = [];
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.quadraticCurveTo(1.1, 0.55, 2.3, 0.28);
  wingShape.quadraticCurveTo(1.5, -0.28, 0.6, -0.42);
  wingShape.quadraticCurveTo(0.2, -0.2, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 8);
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    const membrane = new THREE.Mesh(wingGeo, new THREE.MeshBasicMaterial({
      color: hsl(theme.vegHue2 + 0.04, 0.9, 0.5), transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    membrane.scale.set(1.35, 1.35, 1.35);
    membrane.rotation.x = -Math.PI / 2;
    if (s < 0) membrane.scale.x = -1.35;
    const edge = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 2.6, 3, 6), featherMat);
    edge.rotation.z = Math.PI / 2 - 0.22;
    edge.position.set(s * 1.25, 0.12, -0.05);
    // glowing feather tips along the trailing edge
    for (let fI = 0; fI < 4; fI++) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 5), glowMat);
      tip.position.set(s * (0.7 + fI * 0.55), 0, 0.14 - fI * 0.1);
      tip.rotation.x = Math.PI / 2;
      wing.add(tip);
    }
    wing.add(membrane, edge);
    wing.position.set(s * 0.38, 1.75, -0.1);
    wing.userData.rest = 0.42;   // dihedral — shallow V readable from behind
    g.add(wing); wings.push(wing);
  }
  // legs (visible when landed)
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 1.35, 6), darkMat);
    leg.position.set(s * 0.2, 0.72, 0.1);
    g.add(leg); legs.push(leg);
  }
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMat);
    e.position.set(s * 0.1, 2.94, -1.0);
    g.add(e);
  }
  g.add(body, neck1, neck2, head, beak);
  g.scale.setScalar(scale);
  g.userData = { wings, legs, head, beak, glowMat, bodyMat };
  return g;
}

export function animateGuardian(g, t, mode) {
  const u = g.userData;
  const flap = mode === 'fly' ? Math.sin(t * 7) * 0.55 : mode === 'tired' ? 0.5 : Math.sin(t * 2) * 0.15;
  u.wings[0].rotation.z = u.wings[0].userData.rest + flap;
  u.wings[1].rotation.z = -u.wings[1].userData.rest - flap;
  const flying = mode === 'fly';
  for (const leg of u.legs) leg.visible = !flying;
  const droop = mode === 'tired' ? -0.42 : 0;
  u.head.position.y = 2.88 + Math.sin(t * 1.7) * 0.05 + droop;
  u.head.position.z = -0.88 + (mode === 'tired' ? 0.22 : 0);
  u.beak.position.y = 2.86 + Math.sin(t * 1.7) * 0.05 + droop;
  u.beak.position.z = -1.5 + (mode === 'tired' ? 0.22 : 0);
}

// --- TEMPORAL GENE (boss drop → power ceremony) -------------------------------------
export function buildGene(theme) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue, 1, 0.75), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  // double helix of beads
  const beads = [];
  for (let i = 0; i < 16; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat);
    const a = i * 0.55;
    b.position.set(Math.cos(a) * 0.22, i * 0.09, Math.sin(a) * 0.22);
    g.add(b); beads.push(b);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat);
    b2.position.set(-Math.cos(a) * 0.22, i * 0.09, -Math.sin(a) * 0.22);
    g.add(b2); beads.push(b2);
  }
  g.userData = { beads };
  return g;
}

// --- BEETLE (power-dependent enemy: spin/slam kills; touch kills) --------------------
export function buildBeetleEnemy(theme, rng, armored = false) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10),
    physMat(armored ? hsl(0.6, 0.5, 0.2) : hsl(theme.flowerHue + 0.3, 0.85, 0.4), { iridescence: 0.9, metalness: armored ? 0.7 : 0.1, roughness: armored ? 0.35 : 0.2 }));
  shell.scale.set(1, 0.62, 1.25);
  shell.position.y = 0.24;
  g.add(shell);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeM);
    e.position.set(s * 0.12, 0.3, -0.4);
    g.add(e);
  }
  const legM = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.8 });
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), legM);
    const s = i % 2 === 0 ? -1 : 1;
    leg.position.set(s * 0.32, 0.12, -0.25 + Math.floor(i / 2) * 0.25);
    leg.rotation.z = s * 0.5;
    g.add(leg); legs.push(leg);
  }
  g.userData = { legs, shell, armored };
  return g;
}

// --- SPITTER PLANT (projectile; spin reflects) ---------------------------------------
export function buildSpitter(theme, rng) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.7, 7),
    new THREE.MeshStandardMaterial({ color: hsl(theme.vegHue, 0.7, 0.3), roughness: 0.7 }));
  stem.position.y = 0.35;
  g.add(stem);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10),
    physMat(hsl(theme.flowerHue + 0.5, 0.9, 0.45), { iridescence: 0.7 }));
  bulb.position.y = 0.8;
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 14),
    new THREE.MeshBasicMaterial({ color: 0xff66aa }));
  mouth.position.set(0, 0.86, -0.2);
  mouth.rotation.x = 0.4;
  g.add(bulb, mouth);
  g.userData = { bulb, mouth };
  return g;
}

// spore projectile (shared geometry via collect/boss systems)
export function buildSpore(color = 0xff77cc) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.add(halo);
  return m;
}

// --- GRAPPLE BLOOM-RING ----------------------------------------------------------------
export function buildGrapplePoint(theme) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue + 0.05, 1, 0.7), transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 26), mat);
  ring.position.y = 1.6;
  const pm = new THREE.MeshStandardMaterial({ color: hsl(theme.flowerHue, 0.9, 0.55), emissive: hsl(theme.flowerHue, 0.9, 0.3), emissiveIntensity: 1, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), pm);
    const a = (i / 6) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.3, 1.6 + Math.sin(a) * 0.3, 0);
    p.rotation.z = -a - Math.PI / 2;
    g.add(p);
  }
  g.add(ring);
  g.userData = { ring };
  return g;
}

// --- COLLAPSING RUIN PLATFORM (time-reversible) -----------------------------------------
export function buildCollapsePad(theme) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 0.92),
    physMat(hsl(theme.flowerHue, 0.4, 0.4), { roughness: 0.6, clearcoat: 0.4 }));
  slab.position.y = 0.02;
  g.add(slab);
  // glowing fault lines
  const lm = new THREE.MeshBasicMaterial({ color: hsl(theme.flowerHue + 0.1, 1, 0.6), transparent: true, opacity: 0.8 });
  for (const [x, z, ry] of [[0.1, 0, 0.4], [-0.15, 0.1, -0.8], [0, -0.12, 1.9]]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.03), lm);
    line.position.set(x, 0.11, z);
    line.rotation.y = ry;
    g.add(line);
  }
  g.userData = { slab };
  return g;
}

// --- GROWTH SEED (time-accelerate → bounce flower) ---------------------------------------
export function buildGrowthSeed(theme) {
  const g = new THREE.Group();
  const seed = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
    physMat(hsl(theme.vegHue + 0.1, 0.9, 0.5), { emissive: hsl(theme.vegHue, 0.9, 0.3), emissiveIntensity: 1 }));
  seed.position.y = 0.14;
  g.add(seed);
  g.userData = { seed, stage: 0 };
  return g;
}

// --- BOUNCE MUSHROOM -----------------------------------------------------------------------
export function buildMushroom(theme, rng) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2d8, roughness: 0.7 }));
  stem.position.y = 0.17;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    physMat(hsl(theme.flowerHue + 0.5, 0.9, 0.5), { roughness: 0.35, clearcoat: 0.8 }));
  cap.position.y = 0.32;
  cap.scale.y = 0.7;
  g.add(stem, cap);
  const dotM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), dotM);
    const a = i * 1.35;
    d.position.set(Math.cos(a) * 0.2, 0.5 - (i % 2) * 0.08, Math.sin(a) * 0.2);
    g.add(d);
  }
  g.userData = { cap };
  return g;
}

// --- HOURGLASS TIME POD (time trial pickups) -------------------------------------------------
export function buildHourglass(kind) { // 'minus' (-3s) | 'freeze' (timer stop 3s)
  const g = new THREE.Group();
  const col = kind === 'minus' ? 0x7dffb0 : 0x9fd8ff;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8),
    new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: 0.5, roughness: 0.1, clearcoat: 1 }));
  glass.position.y = 0.55;
  const sand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshBasicMaterial({ color: col }));
  sand.position.y = 0.5;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 18),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.55;
  g.add(glass, sand, halo);
  g.userData = { halo, kind };
  return g;
}

// --- DEATH ROUTE GATE -------------------------------------------------------------------------
export function buildDeathGate(theme) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2255, transparent: true, opacity: 0.85 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 8, 24, Math.PI), mat);
  arch.position.y = 0.1;
  g.add(arch);
  const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat);
  skull.position.y = 1.0;
  g.add(skull);
  g.userData = { arch, skull, mat };
  return g;
}

// --- CHASE SERPENT (giant fractal snake pursuer) -------------------------------------------------
export function buildChaseSerpent(theme) {
  const g = new THREE.Group();
  const mat = physMat(hsl(theme.flowerHue, 0.9, 0.4), { iridescence: 1, emissive: hsl(theme.flowerHue, 0.8, 0.25), emissiveIntensity: 1 });
  const segs = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 - i * 0.055, 1), mat);
    segs.push(s); g.add(s);
  }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), eyeM);
    e.position.set(sd * 0.45, 0.5, 0.4);
    segs[0].add(e);
  }
  // mandible glow
  const maw = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xff4488, transparent: true, opacity: 0.9 }));
  maw.rotation.x = Math.PI / 2;
  maw.position.set(0, 0.1, 0.9);
  segs[0].add(maw);
  g.userData = { segs };
  return g;
}

export function animateChaseSerpent(g, t) {
  const segs = g.userData.segs;
  for (let i = 0; i < segs.length; i++) {
    segs[i].position.set(
      Math.sin(t * 3.2 - i * 0.55) * (0.5 + i * 0.12),
      0.7 + Math.sin(t * 2.1 - i * 0.4) * 0.25 + i * 0.02,
      -i * 1.15
    );
  }
}
