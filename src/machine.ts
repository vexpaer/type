import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { enamelSurface, keyLegendAtlas, contactShadow } from './materials';
import { typebarPose } from './mechanics.js';

export type MovingBar = { group: THREE.Group; rest: THREE.Quaternion; raised: THREE.Quaternion; strokes: number[] };
export type MovingKey = { group: THREE.Group; rest: number; value: string; bar: MovingBar | null; lever?: THREE.Group; strokes: number[]; spring: { position: number; velocity: number } };
type Material = THREE.MeshStandardMaterial;

/** A continuous cast shell, a recessed keyboard, and individually hinged type bars. */
export function buildMachine(own: <T extends THREE.Texture>(texture: T) => T) {
  const machine = new THREE.Group(), carriage = new THREE.Group(), lever = new THREE.Group(), ribbonLift = new THREE.Group();
  const typeBasket = new THREE.Group(), bellStriker = new THREE.Group();
  machine.add(typeBasket);
  const keys = new Map<string, MovingKey>(), targets: THREE.Object3D[] = [], bars: MovingBar[] = [];
  const spools: THREE.Group[] = [], rollers: THREE.Object3D[] = [];
  const grain = own(enamelSurface());
  const enamel = new THREE.MeshPhysicalMaterial({ color: 0x17201d, metalness: .08, roughness: .36, clearcoat: .38, clearcoatRoughness: .29, bumpMap: grain, bumpScale: .006 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x19201c, metalness: .12, roughness: .48 });
  const black = new THREE.MeshStandardMaterial({ color: 0x101311, roughness: .49, metalness: .08 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9c9f97, metalness: .95, roughness: .28 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3c423e, metalness: .83, roughness: .4 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a7851, metalness: .8, roughness: .43 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171816, roughness: .92, bumpMap: grain, bumpScale: .006 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x080b09, roughness: 1 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0x96998b, metalness: .88, roughness: .39 });
  const keyBlack = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .49, metalness: .03 });
  const red = new THREE.MeshStandardMaterial({ color: 0x6c3028, roughness: .62, metalness: .04 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0x171315, roughness: 1 });
  const box = (w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0, radius = .035, parent: THREE.Object3D = machine) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const cylinder = (r: number, h: number, mat: Material, x: number, y: number, z: number, parent: THREE.Object3D = machine, segments = 24) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: Material, parent: THREE.Object3D = machine) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const ring = (r: number, tube: number, mat: Material, x: number, y: number, z: number, parent: THREE.Object3D = machine) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 32), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  };
  const screw = (x: number, y: number, z: number, parent: THREE.Object3D = machine) => {
    cylinder(.038, .016, steel, x, y, z, parent, 12); box(.048, .003, .008, black, x, y + .01, z, .001, parent);
  };
  const label = (text: string, width: number, height: number, x: number, y: number, z: number, parent: THREE.Object3D = machine, color = '#c9c1a8', font = '500 90px Georgia') => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 512, 130);
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: .7, depthWrite: false }));
    m.position.set(x, y, z); parent.add(m); return m;
  };

  // One broad foundation with continuous, swept side cheeks and a rolled front apron.
  for (const x of [-2.96, 2.96]) for (const z of [-1.77, 1.98]) cylinder(.23, .17, rubber, x, -.025, z);
  box(7.38, .36, 5.1, enamel, 0, .23, .12, .17);
  const profile = new THREE.Shape();
  profile.moveTo(-2.22, .32); profile.lineTo(-2.22, 1.28);
  profile.bezierCurveTo(-2.22, 1.59, -2.06, 1.65, -1.76, 1.61);
  profile.bezierCurveTo(-1.08, 1.56, -.75, 1.3, -.34, 1.02);
  profile.bezierCurveTo(.42, .68, 1.56, .55, 2.25, .51);
  profile.quadraticCurveTo(2.56, .49, 2.53, .29); profile.closePath();
  const cheekGeometry = new THREE.ExtrudeGeometry(profile, { depth: .3, bevelEnabled: true, bevelThickness: .105, bevelSize: .105, bevelSegments: 5, curveSegments: 28, steps: 1 });
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeometry, enamel); cheek.rotation.y = side * Math.PI / 2;
    cheek.scale.x = -side; cheek.position.x = side * 3.24; cheek.castShadow = cheek.receiveShadow = true; machine.add(cheek);
  }
  const apron = box(6.67, .31, .28, enamel, 0, .43, 2.52, .115); apron.rotation.x = -.12;
  box(6.55, .025, .035, edge, 0, .33, 2.673, .012);
  const bed = box(6.43, .075, 3.12, felt, 0, .58, .81, .03); bed.rotation.x = .2;
  box(6.62, .56, .58, enamel, 0, 1.2, -1.95, .16);
  for (const side of [-1, 1]) {
    const hood = box(1.18, .28, 1.38, enamel, side * 2.55, 1.29, -1.05, .13); hood.rotation.x = .08;
    screw(side * 3.17, 1.46, -1.3); screw(side * 3.2, .67, 1.48);
  }
  const badge = label('type.', 1.0, .25, 0, .45, 2.682, machine, '#b8ae91', 'italic 125px Georgia'); badge.rotation.x = -.12;

  // Dark segment recesses put the resting type bars inside the instrument.
  const basket = new THREE.Shape(); basket.absarc(0, 0, 1.74, .1, Math.PI - .1, false);
  basket.lineTo(-1.4, .02); basket.absarc(0, 0, 1.4, Math.PI - .1, .1, true); basket.closePath();
  const basketMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(basket, { depth: .14, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 44 }), black);
  basketMesh.rotation.x = -Math.PI / 2; basketMesh.position.set(0, .95, -1.38); basketMesh.castShadow = basketMesh.receiveShadow = true; typeBasket.add(basketMesh);
  for (let i = 0; i < 44; i++) {
    const pose = typebarPose(i), pivot = new THREE.Group(); pivot.position.fromArray(pose.pivot);
    const rest = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().fromArray(pose.resting).normalize());
    const raised = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().fromArray(pose.raised));
    pivot.quaternion.copy(rest); typeBasket.add(pivot);
    box(.025, pose.length - .08, .024, steel, 0, (pose.length - .08) / 2, 0, .006, pivot);
    box(.064, .08, .052, steel, 0, pose.length - .04, 0, .008, pivot);
    cylinder(.036, .075, brass, pose.pivot[0], pose.pivot[1] - .04, pose.pivot[2], typeBasket, 10);
    bars.push({ group: pivot, rest, raised, strokes: [] });
  }

  // Thin, shallow keys. Shared instanced meshes keep each key's transform and hit target.
  const ordered: MovingKey[] = [], legends: { text: string; sub: string }[] = [], colors: THREE.Color[] = [];
  let barIndex = 0;
  const makeKey = (text: string, value: string, x: number, y: number, z: number, sub = '', redKey = false) => {
    const group = new THREE.Group(); group.position.set(x, y, z); machine.add(group);
    const hasBar = value.length === 1;
    // Each printable key drives an exposed rearward lever under the recessed bed.
    const lever = hasBar ? new THREE.Group() : undefined;
    if (lever) {
      lever.position.set(x, y - .245, z - .12); machine.add(lever);
      rod(new THREE.Vector3(0, 0, .06), new THREE.Vector3(0, -.045, -.48), .012, steel, lever);
      cylinder(.028, .065, brass, 0, 0, .05, lever, 10);
      box(.09, .025, .11, nickel, 0, -.05, -.46, .006, lever);
    }
    const key: MovingKey = { group, rest: y, value, bar: hasBar ? bars[barIndex++] : null, lever, strokes: [], spring: { position: 0, velocity: 0 } };
    keys.set(value, key); ordered.push(key); legends.push({ text, sub }); colors.push(new THREE.Color(redKey ? 0x5a2823 : 0x101713));
  };
  const rows = [
    { letters: '1234567890-', subs: '!@#$%^&*()_', z: .05, y: 1.01, offset: -.14 },
    { letters: 'QWERTYUIOP', subs: '', z: .59, y: .9, offset: -.13 },
    { letters: 'ASDFGHJKL;', subs: '', z: 1.13, y: .79, offset: .03 },
    { letters: 'ZXCVBNM,./', subs: '', z: 1.67, y: .68, offset: .19 },
  ];
  for (const row of rows) [...row.letters].forEach((letter, i) => makeKey(letter, letter.toLowerCase(), (i - (row.letters.length - 1) / 2) * .535 + row.offset, row.y, row.z, row.subs[i] || ''));
  // Etched character faces share one texture atlas; each typebar carries its own slug.
  const slugCanvas = document.createElement('canvas'); slugCanvas.width = 1024; slugCanvas.height = 768;
  const slugCtx = slugCanvas.getContext('2d')!;
  slugCtx.clearRect(0, 0, slugCanvas.width, slugCanvas.height);
  slugCtx.textAlign = 'center'; slugCtx.textBaseline = 'middle'; slugCtx.font = 'bold 87px Georgia'; slugCtx.fillStyle = '#d6d7ce';
  ordered.forEach((key, i) => slugCtx.fillText(key.value.toUpperCase(), (i % 8 + .5) * 128, (Math.floor(i / 8) + .51) * 128));
  const slugTexture = own(new THREE.CanvasTexture(slugCanvas)); slugTexture.colorSpace = THREE.SRGBColorSpace;
  const slugMaterial = new THREE.MeshStandardMaterial({ map: slugTexture, transparent: true, depthWrite: false, roughness: .66, metalness: .33, side: THREE.DoubleSide });
  ordered.forEach((key, i) => {
    if (!key.bar) return;
    const geometry = new THREE.PlaneGeometry(.047, .048);
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, (i % 8 + uv.getX(j)) / 8, 1 - (Math.floor(i / 8) + 1 - uv.getY(j)) / 6);
    const face = new THREE.Mesh(geometry, slugMaterial); face.position.set(0, typebarPose(i).length - .044, .031); key.bar.group.add(face);
  });
  makeKey('SHIFT', 'shift', -2.97, .68, 1.67); makeKey('SHIFT', 'shift-right', 3.08, .68, 1.67);
  makeKey('BACK', 'backspace', 3.05, 1.01, .05, '', true); makeKey('LOCK', 'capslock', -3.01, .9, .59, '', true);
  const cap = new THREE.LatheGeometry([new THREE.Vector2(.025, -.23), new THREE.Vector2(.025, -.04), new THREE.Vector2(.178, -.04), new THREE.Vector2(.197, -.016), new THREE.Vector2(.197, .025), new THREE.Vector2(.182, .03)], 32);
  const inset = new THREE.LatheGeometry([new THREE.Vector2(.184, .029), new THREE.Vector2(.172, .022), new THREE.Vector2(.1, .012), new THREE.Vector2(0, .01)], 32);
  const rim = new THREE.TorusGeometry(.19, .0075, 6, 32); rim.rotateX(-Math.PI / 2); rim.translate(0, .029, 0);
  const legend = new THREE.CircleGeometry(.174, 32); legend.rotateX(-Math.PI / 2); legend.translate(0, .033, 0);
  const atlasRects: number[] = [];
  legends.forEach((_, i) => atlasRects.push(i % 8 / 8, 1 - (Math.floor(i / 8) + 1) / 8, 1 / 8, 1 / 8));
  legend.setAttribute('atlasRect', new THREE.InstancedBufferAttribute(new Float32Array(atlasRects), 4));
  const legendMaterial = new THREE.MeshStandardMaterial({ map: own(keyLegendAtlas(legends)), transparent: true, roughness: .88, depthWrite: false });
  legendMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec4 atlasRect;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vMapUv * atlasRect.zw + atlasRect.xy;\n#endif');
  };
  legendMaterial.customProgramCacheKey = () => 'type-key-atlas-v1';
  const keyMeshes = [[cap, steel], [inset, keyBlack], [rim, nickel], [legend, legendMaterial]].map(([geometry, material]) => {
    const mesh = new THREE.InstancedMesh(geometry as THREE.BufferGeometry, material as Material, ordered.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    mesh.castShadow = geometry === cap; mesh.receiveShadow = geometry === inset;
    mesh.userData.keys = ordered; machine.add(mesh);
    if (geometry === cap || geometry === inset) targets.push(mesh);
    if (geometry === inset) colors.forEach((color, i) => mesh.setColorAt(i, color));
    return mesh;
  });
  const syncKeys = () => {
    ordered.forEach((key, i) => { key.group.updateMatrix(); keyMeshes.forEach(mesh => mesh.setMatrixAt(i, key.group.matrix)); });
    keyMeshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
  };
  syncKeys();
  const space = new THREE.Group(); space.position.set(0, .55, 2.25); machine.add(space);
  for (const x of [-1.5, 1.5]) rod(new THREE.Vector3(x, -.16, -.07), new THREE.Vector3(x, -.03, 0), .028, steel, space);
  box(4.34, .075, .3, edge, 0, 0, 0, .035, space);
  const spaceFace = box(4.28, .055, .29, black, 0, .035, .005, .025, space);
  const spaceKey: MovingKey = { group: space, rest: .55, value: ' ', bar: null, strokes: [], spring: { position: 0, velocity: 0 } };
  spaceFace.userData.key = spaceKey; targets.push(spaceFace); keys.set(' ', spaceKey);

  // Recessed ribbon spools and a two-colour ribbon that passes the common strike point.
  for (const side of [-1, 1]) {
    const spool = new THREE.Group(); spool.position.set(side * 2.32, 1.53, -1.17); machine.add(spool); spools.push(spool);
    cylinder(.62, .075, black, 0, -.025, 0, spool); cylinder(.51, .1, ribbon, 0, .035, 0, spool);
    const disc = new THREE.Shape(); disc.absarc(0, 0, .61, 0, Math.PI * 2, false);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, hole = new THREE.Path(); hole.absarc(Math.cos(a) * .34, Math.sin(a) * .34, .09, 0, Math.PI * 2, true); disc.holes.push(hole); }
    const flange = new THREE.Mesh(new THREE.ExtrudeGeometry(disc, { depth: .018, bevelEnabled: true, bevelThickness: .005, bevelSize: .005, bevelSegments: 1, curveSegments: 24 }), edge);
    flange.rotation.x = -Math.PI / 2; flange.position.y = .1; flange.castShadow = true; spool.add(flange);
    ring(.587, .008, steel, 0, .125, 0, spool); ring(.13, .009, nickel, 0, .13, 0, spool);
    cylinder(.1, .038, black, 0, .15, 0, spool); screw(0, .178, 0, spool);
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(1.91, .09), ribbon);
    tape.position.set(side * 1.15, 1.75, -1.46); tape.rotation.y = side * .16; tape.rotation.z = side * .12; machine.add(tape);
  }
  ribbonLift.position.set(0, 1.91, -1.515); machine.add(ribbonLift);
  box(.48, .092, .016, ribbon, 0, 0, 0, .003, ribbonLift); box(.48, .056, .016, red, 0, -.07, 0, .003, ribbonLift);
  for (const x of [-.26, .26]) box(.023, .25, .045, steel, x, -.025, .025, .006, ribbonLift);

  machine.add(carriage);
  for (const z of [-2.2, -1.74]) { const rail = cylinder(.045, 8.05, chrome, 0, 1.62, z, carriage); rail.rotation.z = Math.PI / 2; }
  box(7.14, .18, .59, black, 0, 1.73, -1.98, .05, carriage);
  const table = box(6.59, .48, .07, enamel, 0, 2.27, -2.13, .025, carriage); table.rotation.x = -.14;
  const platen = cylinder(.264, 6.5, rubber, 0, 2.04, -1.82, carriage, 48); platen.rotation.z = Math.PI / 2;
  // Rotate a parent around the true X axle, preserving the cylinder's Z orientation.
  const platenAxle = new THREE.Group(); platenAxle.position.copy(platen.position); carriage.remove(platen); platen.position.set(0, 0, 0); platenAxle.add(platen); carriage.add(platenAxle); rollers.push(platenAxle);
  const axle = cylinder(.052, 8.15, chrome, 0, 2.04, -1.82, carriage); axle.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const knob = new THREE.Group(); knob.position.set(side * 3.93, 2.04, -1.82); carriage.add(knob); rollers.push(knob);
    const core = cylinder(.27, .28, black, 0, 0, 0, knob, 40); core.rotation.z = Math.PI / 2;
    const collar = cylinder(.18, .1, nickel, -side * .19, 0, 0, knob); collar.rotation.z = Math.PI / 2;
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, grip = box(.28, .012, .018, edge, 0, Math.sin(a) * .269, Math.cos(a) * .269, .002, knob); grip.rotation.x = -a; }
    box(.14, .41, .5, enamel, side * 3.38, 1.99, -1.87, .045, carriage);
    const gear = cylinder(.17, .05, brass, side * 3.53, 2.04, -1.82, carriage, 20); gear.rotation.z = Math.PI / 2;
  }
  const bail = cylinder(.024, 6.56, chrome, 0, 2.31, -1.51, carriage); bail.rotation.z = Math.PI / 2;
  for (const x of [-2.27, 2.27]) {
    const wheelAxle = new THREE.Group(); wheelAxle.position.set(x, 2.31, -1.51); carriage.add(wheelAxle); rollers.push(wheelAxle);
    const wheel = cylinder(.082, .19, rubber, 0, 0, 0, wheelAxle); wheel.rotation.z = Math.PI / 2;
    rod(new THREE.Vector3(x, 1.9, -1.45), new THREE.Vector3(x, 2.31, -1.51), .023, steel, carriage);
  }
  box(6.25, .07, .065, steel, 0, 1.82, -1.44, .015, carriage);
  const scaleCanvas = document.createElement('canvas'); scaleCanvas.width = 2048; scaleCanvas.height = 128;
  const sc = scaleCanvas.getContext('2d')!; sc.fillStyle = '#999b8a'; sc.fillRect(0, 0, 2048, 128); sc.fillStyle = '#292e26'; sc.font = '29px Georgia'; sc.textAlign = 'center';
  for (let i = 0; i <= 80; i++) { const x = 24 + i * 25; sc.fillRect(x, i % 5 ? 73 : 52, i % 5 ? 2 : 3, i % 5 ? 31 : 52); if (!(i % 10)) sc.fillText(String(i), x, 37); }
  const scaleMap = own(new THREE.CanvasTexture(scaleCanvas)); scaleMap.colorSpace = THREE.SRGBColorSpace;
  const scale = new THREE.Mesh(new THREE.PlaneGeometry(6.2, .16), new THREE.MeshStandardMaterial({ map: scaleMap, metalness: .4, roughness: .53 })); scale.position.set(0, 1.9, -1.403); carriage.add(scale);
  for (const x of [-2.68, 2.68]) { box(.11, .16, .1, black, x, 1.94, -1.42, .018, carriage); box(.038, .055, .012, red, x, 1.98, -1.36, .003, carriage); }
  carriage.add(lever); lever.position.set(-3.53, 2.02, -1.94);
  rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.6, .4, .34), .033, chrome, lever);
  rod(new THREE.Vector3(-.6, .4, .34), new THREE.Vector3(-.12, .4, .49), .037, chrome, lever);
  const returnPad = box(.52, .075, .2, black, -.1, .4, .49, .035, lever);
  returnPad.userData.key = { group: lever, rest: 2.02, value: 'enter', bar: null, strokes: [], spring: { position: 0, velocity: 0 } } satisfies MovingKey;
  targets.push(returnPad);
  // The carriage-mounted margin bell has a separate swinging hammer. Both ride the rails.
  const bell = new THREE.Group(); bell.position.set(3.43, 1.84, -1.99); carriage.add(bell);
  cylinder(.155, .14, brass, 0, .1, 0, bell, 32);
  cylinder(.19, .028, nickel, 0, .02, 0, bell, 32);
  cylinder(.023, .07, chrome, 0, .205, 0, bell);
  cylinder(.048, .025, brass, 0, .255, 0, bell);
  bellStriker.position.set(-.26, .11, .085); bell.add(bellStriker);
  rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(.18, .045, -.04), .022, chrome, bellStriker);
  cylinder(.038, .063, steel, .18, .045, -.04, bellStriker, 12);
  cylinder(.045, .07, red, 3.08, 1.23, -.24);

  // Local contact occlusion under the chassis and in the recessed keyboard.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9.1, 6.3), new THREE.MeshBasicMaterial({ map: own(contactShadow()), transparent: true, depthWrite: false, opacity: .8 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -.105, .15); machine.add(shadow);
  // Batch static meshes recursively within each moving assembly, leaving hit targets intact.
  for (const root of [machine, carriage, typeBasket, bell, bellStriker, ...spools, ...rollers, lever, ...bars.map(bar => bar.group), space]) {
    const batches = new Map<string, { material: THREE.Material; shadow: boolean; meshes: THREE.Mesh[] }>();
    for (const object of [...root.children]) {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) || targets.includes(object) || object.material.transparent) continue;
      const id = `${object.material.uuid}:${object.castShadow}`;
      if (!batches.has(id)) batches.set(id, { material: object.material, shadow: object.castShadow, meshes: [] });
      batches.get(id)!.meshes.push(object);
    }
    const retired = new Set<THREE.BufferGeometry>();
    for (const batch of batches.values()) {
      if (batch.meshes.length < 2) continue;
      const pieces = batch.meshes.map(mesh => {
        mesh.updateMatrix();
        const geometry = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix);
        // Mirroring a side cheek reverses its winding; baking it must preserve front faces.
        if (mesh.matrix.determinant() < 0) {
          for (const attribute of Object.values(geometry.attributes)) {
            for (let i = 0; i < attribute.count; i += 3) for (let c = 0; c < attribute.itemSize; c++) {
              const a = i * attribute.itemSize + c, b = (i + 2) * attribute.itemSize + c;
              const value = attribute.array[a]; attribute.array[a] = attribute.array[b]; attribute.array[b] = value;
            }
          }
        }
        return geometry;
      });
      const merged = mergeGeometries(pieces);
      if (merged) { const mesh = new THREE.Mesh(merged, batch.material); if (batch.material === enamel) mesh.name = 'enamel-casting'; mesh.castShadow = batch.shadow; mesh.receiveShadow = true; root.add(mesh); batch.meshes.forEach(old => { root.remove(old); retired.add(old.geometry); }); }
      pieces.forEach(piece => piece.dispose());
    }
    // A shared geometry (e.g. the two cheeks) is retired only after both have been batched.
    retired.forEach(geometry => geometry.dispose());
  }
  return { machine, carriage, typeBasket, bellStriker, keys, bars, targets, spools, rollers, lever, ribbonLift, syncKeys };
}
