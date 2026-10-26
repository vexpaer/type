import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { enamelSurface, labelTexture } from './materials';

export type MovingKey = { group: THREE.Group; rest: number; pressedAt: number; bar: THREE.Group | null; value: string };
type Material = THREE.MeshStandardMaterial;

/** Original Continental-inspired geometry; all structural details are real meshes. */
export function buildMachine(own: <T extends THREE.Texture>(texture: T) => T) {
  const machine = new THREE.Group(), carriage = new THREE.Group(), lever = new THREE.Group(), ribbonLift = new THREE.Group();
  const keys = new Map<string, MovingKey>(), targets: THREE.Object3D[] = [], spools: THREE.Group[] = [], rollers: THREE.Mesh[] = [];
  const grain = own(enamelSurface());
  const enamel = new THREE.MeshStandardMaterial({ color: 0x242d29, metalness: .65, roughness: .49, bumpMap: grain, bumpScale: .025, roughnessMap: grain });
  const edge = new THREE.MeshStandardMaterial({ color: 0x252e28, metalness: .58, roughness: .48 });
  const black = new THREE.MeshStandardMaterial({ color: 0x131715, roughness: .54, metalness: .35 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb9b8a9, metalness: .96, roughness: .22 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb7a271, metalness: .85, roughness: .31 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x171917, roughness: .94, bumpMap: grain, bumpScale: .013 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x090f0c, roughness: 1, bumpMap: grain, bumpScale: .045 });
  const keyMetal = new THREE.MeshStandardMaterial({ color: 0x555b52, metalness: .76, roughness: .43, bumpMap: grain, bumpScale: .005 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xa29f8d, metalness: .88, roughness: .34 });
  const keyBlack = new THREE.MeshPhysicalMaterial({ color: 0x101712, roughness: .58, metalness: .05, clearcoat: .18, clearcoatRoughness: .43 });
  const keyRed = new THREE.MeshPhysicalMaterial({ color: 0x602b26, roughness: .64, metalness: .03, clearcoat: .12, clearcoatRoughness: .5 });
  const red = new THREE.MeshStandardMaterial({ color: 0x77332c, roughness: .66, metalness: .12 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0x171416, roughness: 1 });
  const box = (w: number, h: number, d: number, mat: Material, x = 0, y = 0, z = 0, radius = .035, parent: THREE.Object3D = machine) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  const cylinder = (r: number, h: number, mat: Material, x: number, y: number, z: number, parent: THREE.Object3D = machine, segments = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: Material, parent: THREE.Object3D = machine) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); parent.add(m); return m;
  };
  const ring = (r: number, tube: number, mat: Material, x: number, y: number, z: number, parent: THREE.Object3D = machine) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 40), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  };
  const screw = (x: number, y: number, z: number, parent: THREE.Object3D = machine) => {
    cylinder(.046, .022, chrome, x, y, z, parent, 12); box(.055, .004, .009, black, x, y + .013, z, .002, parent);
  };
  const label = (text: string, width: number, height: number, x: number, y: number, z: number, parent: THREE.Object3D = machine, color = '#d9c99f', font = 'bold 60px Georgia') => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 512, 133);
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: .6, metalness: .25, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  };

  // Cast base, rolled perimeter, feet and a recessed felt bed under the key comb.
  for (const x of [-2.95, 2.95]) for (const z of [-1.75, 2.0]) { cylinder(.28, .22, rubber, x, -.015, z); cylinder(.22, .075, edge, x, .12, z); }
  box(7.55, .28, 5.35, black, 0, .2, .12, .16);
  box(7.45, .28, 5.22, edge, 0, .34, .1, .16);
  box(7.32, .22, 5.12, enamel, 0, .47, .1, .14);
  box(6.55, .1, 3.73, felt, 0, .54, .61, .05);
  box(6.95, .18, .28, enamel, 0, .6, 2.59, .075);
  // Rounded, profile-extruded cheeks rise around the exposed mechanism.
  const profile = new THREE.Shape();
  profile.moveTo(-2.25, .5); profile.lineTo(-2.25, 1.35); profile.quadraticCurveTo(-2.2, 1.61, -1.85, 1.62);
  profile.lineTo(-.65, 1.42); profile.quadraticCurveTo(-.3, 1.35, -.1, 1.12); profile.lineTo(2.38, .74);
  profile.quadraticCurveTo(2.6, .71, 2.6, .52); profile.closePath();
  const cheekGeometry = new THREE.ExtrudeGeometry(profile, { depth: .36, bevelEnabled: true, bevelThickness: .075, bevelSize: .075, bevelSegments: 3, steps: 1, curveSegments: 16 });
  for (const x of [-3.52, 3.16]) {
    const cheek = new THREE.Mesh(cheekGeometry, enamel); cheek.rotation.y = -Math.PI / 2; cheek.position.x = x + .36;
    cheek.castShadow = cheek.receiveShadow = true; machine.add(cheek);
  }
  box(6.85, .73, .76, enamel, 0, 1.11, -1.85, .13);
  box(6.35, .11, .3, edge, 0, 1.49, -2.0, .045);
  for (const side of [-1, 1]) {
    const hood = box(1.34, .29, 1.66, enamel, side * 2.54, 1.31, -1.02, .15); hood.rotation.x = .12;
    box(.68, .025, .4, black, side * 2.65, 1.481, -.38, .06);
    label('type.', .62, .28, side * 2.65, 1.501, -.38, machine, '#cec4a4', 'italic bold 115px Georgia');
    screw(side * 3.2, 1.48, -1.3); screw(side * 3.2, .92, 1.14);
  }
  // Horseshoe segment, pivot comb and separate steel type bars.
  for (let i = 0; i < 47; i++) {
    const angle = (i / 46 - .5) * 2.42, x = Math.sin(angle) * 1.85, z = -1.68 + Math.cos(angle) * 1.25;
    rod(new THREE.Vector3(x, 1.25, z), new THREE.Vector3(x * 1.12, 1.02, z + .18), .028, brass);
    box(.032, .13, .15, chrome, x, 1.29, z, .006);
  }
  const bars: THREE.Group[] = [];
  for (let i = 0; i < 45; i++) {
    const angle = (i / 44 - .5) * 2.3, x = Math.sin(angle) * 1.78, z = -1.68 + Math.cos(angle) * 1.15;
    const pivot = new THREE.Group(); pivot.position.set(0, 1.68, -1.72);
    rod(new THREE.Vector3(x, -.39, z + 1.72), new THREE.Vector3(x * .11, -.02, .1), .018, chrome, pivot);
    box(.066, .09, .12, edge, x, -.36, z + 1.72, .009, pivot);
    machine.add(pivot); bars.push(pivot);
  }
  // Thin nickel-ring keys, with an actual shallow concave face. Return springs live
  // below the keyboard bed, as on the reference; only the slender steel stems show.
  const capGeometry = new THREE.LatheGeometry([new THREE.Vector2(.035, -.031), new THREE.Vector2(.165, -.029), new THREE.Vector2(.196, -.018), new THREE.Vector2(.205, .005), new THREE.Vector2(.202, .027), new THREE.Vector2(.188, .031)], 40);
  const faceGeometry = new THREE.LatheGeometry([new THREE.Vector2(0, .018), new THREE.Vector2(.07, .018), new THREE.Vector2(.14, .021), new THREE.Vector2(.176, .028), new THREE.Vector2(.188, .033)].reverse(), 40);
  const legendGeometry = new THREE.CircleGeometry(.177, 40), rimGeometry = new THREE.TorusGeometry(.196, .0105, 8, 40);
  const stemGeometry = new THREE.CylinderGeometry(.025, .031, .27, 10);
  const metalPieces = [stemGeometry.clone().translate(0, -.16, 0), capGeometry.clone()];
  const metalGeometry = mergeGeometries(metalPieces.map(g => g.toNonIndexed()))!;
  metalPieces.forEach(g => g.dispose()); stemGeometry.dispose(); capGeometry.dispose();
  let keyIndex = 0;
  const makeKey = (text: string, value: string, x: number, y: number, z: number, sub = '', redKey = false) => {
    const group = new THREE.Group(); group.position.set(x, y, z); machine.add(group);
    if (value === 'shift' || value === 'shift-right') group.scale.set(1.12, 1, 1.12);
    const cap = new THREE.Mesh(metalGeometry, keyMetal); cap.castShadow = true; group.add(cap);
    const rim = new THREE.Mesh(rimGeometry, nickel); rim.rotation.x = -Math.PI / 2; rim.position.y = .033; group.add(rim);
    const inset = new THREE.Mesh(faceGeometry, redKey ? keyRed : keyBlack); inset.receiveShadow = true; group.add(inset);
    const map = own(labelTexture(text, sub, !redKey));
    const face = new THREE.Mesh(legendGeometry, new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .85, metalness: 0, depthWrite: false }));
    face.rotation.x = -Math.PI / 2; face.position.y = .037; group.add(face);
    const key: MovingKey = { group, rest: y, pressedAt: -10000, bar: bars[keyIndex++ % bars.length], value };
    inset.userData.key = key; cap.userData.key = key; targets.push(inset, cap); keys.set(value, key);
    rod(new THREE.Vector3(x, y - .25, z), new THREE.Vector3(x * .84, .68, -.45), .022, edge);
  };
  const rows = [
    { letters: '1234567890-', subs: '!@#$%^&*()_', z: -.04, y: 1.19, offset: -.14 },
    { letters: 'QWERTYUIOP', subs: '', z: .56, y: 1.06, offset: -.13 },
    { letters: 'ASDFGHJKL;', subs: '', z: 1.16, y: .92, offset: .03 },
    { letters: 'ZXCVBNM,./', subs: '', z: 1.76, y: .79, offset: .19 },
  ];
  for (const row of rows) [...row.letters].forEach((letter, i) => makeKey(letter, letter.toLowerCase(), (i - (row.letters.length - 1) / 2) * .535 + row.offset, row.y, row.z, row.subs[i] || ''));
  makeKey('SHIFT', 'shift', -2.97, .9, 1.72); makeKey('SHIFT', 'shift-right', 3.08, .9, 1.72);
  makeKey('BACK', 'backspace', 3.05, 1.19, -.04, '', true); makeKey('LOCK', 'capslock', -3.01, 1.05, .56, '', true);
  const space = new THREE.Group(); space.position.set(0, .73, 2.35); machine.add(space);
  for (const x of [-1.6, 1.6]) rod(new THREE.Vector3(x, -.2, -.08), new THREE.Vector3(x, 0, 0), .045, chrome, space);
  box(4.35, .095, .31, edge, 0, 0, 0, .045, space);
  const spaceFace = box(4.28, .075, .29, black, 0, .045, .005, .035, space);
  const spaceKey: MovingKey = { group: space, rest: .73, pressedAt: -10000, bar: null, value: ' ' };
  spaceFace.userData.key = spaceKey; targets.push(spaceFace); keys.set(' ', spaceKey);

  // Through-hole spool flanges, concentric wound ribbon, hubs and slotted screws.
  for (const side of [-1, 1]) {
    const spool = new THREE.Group(); spool.position.set(side * 2.32, 1.64, -1.17); machine.add(spool); spools.push(spool);
    cylinder(.65, .075, black, 0, -.055, 0, spool); cylinder(.53, .14, ribbon, 0, .02, 0, spool);
    const disc = new THREE.Shape(); disc.absarc(0, 0, .64, 0, Math.PI * 2, false);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, hole = new THREE.Path(); hole.absarc(Math.cos(a) * .34, Math.sin(a) * .34, .098, 0, Math.PI * 2, true); disc.holes.push(hole); }
    const flange = new THREE.Mesh(new THREE.ExtrudeGeometry(disc, { depth: .025, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1, curveSegments: 24 }), enamel);
    flange.rotation.x = -Math.PI / 2; flange.position.y = .12; flange.castShadow = true; spool.add(flange);
    ring(.614, .012, edge, 0, .151, 0, spool); ring(.14, .012, chrome, 0, .156, 0, spool);
    cylinder(.115, .052, black, 0, .172, 0, spool); screw(0, .207, 0, spool);
    for (const r of [.47, .49, .51]) ring(r, .004, edge, 0, .09, 0, spool);
    rod(new THREE.Vector3(side * 1.82, 1.72, -1.2), new THREE.Vector3(side * .22, 1.86, -1.73), .013, ribbon);
  }
  ribbonLift.position.set(0, 1.92, -1.62); machine.add(ribbonLift);
  box(.51, .105, .018, ribbon, 0, 0, 0, .003, ribbonLift); box(.51, .065, .018, red, 0, -.08, 0, .003, ribbonLift);
  for (const x of [-.27, .27]) { box(.027, .29, .06, chrome, x, -.03, .025, .008, ribbonLift); screw(x, -.16, .02, ribbonLift); }
  // Twin carriage rails, paper table, rubber platen and precisely knurled knobs.
  machine.add(carriage);
  for (const z of [-2.21, -1.7]) { const rail = cylinder(.065, 8.35, chrome, 0, 1.61, z, carriage); rail.rotation.z = Math.PI / 2; }
  box(7.45, .2, .69, black, 0, 1.72, -1.98, .06, carriage);
  const table = box(6.75, .48, .09, enamel, 0, 2.28, -2.14, .035, carriage); table.rotation.x = -.11;
  const mark = label('t y p e .', 3.0, .4, 0, 2.37, -2.075, carriage, '#e3dcc7', 'bold 115px Georgia'); mark.rotation.x = -.11;
  const platen = cylinder(.255, 6.65, rubber, 0, 2.04, -1.82, carriage, 64); platen.rotation.z = Math.PI / 2; rollers.push(platen);
  const axle = cylinder(.066, 8.35, chrome, 0, 2.04, -1.82, carriage); axle.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const knob = new THREE.Group(); knob.position.set(side * 4.0, 2.04, -1.82); carriage.add(knob);
    const core = cylinder(.3, .32, black, 0, 0, 0, knob, 48); core.rotation.z = Math.PI / 2;
    const outer = cylinder(.23, .012, enamel, side * .17, 0, 0, knob); outer.rotation.z = Math.PI / 2;
    const collar = cylinder(.22, .13, chrome, -side * .22, 0, 0, knob); collar.rotation.z = Math.PI / 2;
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; const grip = box(.32, .016, .024, edge, 0, Math.sin(a) * .295, Math.cos(a) * .295, .003, knob); grip.rotation.x = -a; }
    box(.15, .48, .61, enamel, side * 3.43, 1.97, -1.86, .045, carriage);
    const gear = cylinder(.2, .065, brass, side * 3.58, 2.04, -1.82, carriage, 24); gear.rotation.z = Math.PI / 2;
    for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10; box(.075, .04, .045, brass, side * 3.58, 2.04 + Math.sin(a) * .2, -1.82 + Math.cos(a) * .2, .004, carriage); }
  }
  const bail = cylinder(.032, 6.72, chrome, 0, 2.24, -1.56, carriage); bail.rotation.z = Math.PI / 2;
  for (const x of [-2.28, 2.28]) {
    const wheel = cylinder(.103, .24, rubber, x, 2.24, -1.56, carriage); wheel.rotation.z = Math.PI / 2; rollers.push(wheel);
    rod(new THREE.Vector3(x, 1.88, -1.4), new THREE.Vector3(x, 2.24, -1.56), .028, chrome, carriage); screw(x, 2.29, -1.55, carriage);
  }
  box(6.42, .095, .09, chrome, 0, 1.84, -1.47, .018, carriage);
  const scaleCanvas = document.createElement('canvas'); scaleCanvas.width = 2048; scaleCanvas.height = 128;
  const sc = scaleCanvas.getContext('2d')!; sc.fillStyle = '#b0ad97'; sc.fillRect(0, 0, 2048, 128); sc.fillStyle = '#272b24'; sc.font = '28px Georgia'; sc.textAlign = 'center';
  for (let i = 0; i <= 80; i++) { const x = 24 + i * 25; sc.fillRect(x, i % 5 ? 70 : 52, i % 5 ? 2 : 3, i % 5 ? 35 : 53); if (!(i % 10)) sc.fillText(String(i), x, 38); }
  const scaleMap = own(new THREE.CanvasTexture(scaleCanvas)); scaleMap.colorSpace = THREE.SRGBColorSpace;
  const scale = new THREE.Mesh(new THREE.PlaneGeometry(6.32, .19), new THREE.MeshStandardMaterial({ map: scaleMap, metalness: .6, roughness: .4 })); scale.position.set(0, 1.9, -1.409); carriage.add(scale);
  for (const x of [-2.65, 2.65]) { box(.14, .19, .13, edge, x, 1.95, -1.42, .022, carriage); box(.055, .08, .015, red, x, 2.01, -1.345, .005, carriage); }
  carriage.add(lever); lever.position.set(-3.53, 1.94, -1.94);
  rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-.75, .52, .4), .045, chrome, lever); rod(new THREE.Vector3(-.75, .52, .4), new THREE.Vector3(-.14, .52, .52), .05, chrome, lever);
  const returnPad = box(.57, .095, .22, black, -.13, .52, .51, .045, lever);
  returnPad.userData.key = { group: lever, rest: 1.94, pressedAt: -10000, bar: null, value: 'enter' } satisfies MovingKey;
  targets.push(returnPad);
  // Vents, selector, rivets, apron wear and engraved maker's plate.
  for (let i = 0; i < 7; i++) box(.025, .013, .33, black, 2.83 + i * .045, 1.49, -.85, .006);
  cylinder(.065, .09, red, 3.08, 1.42, -.21);
  for (const x of [-3.36, 3.36]) for (const z of [1.9, 2.33]) screw(x, .7, z);
  box(1.22, .15, .018, brass, 0, .35, 2.79, .018);
  const badge = label('type.  •  MECHANICAL', 1.1, .13, 0, .35, 2.805, machine, '#332c1f', 'bold 70px Georgia'); badge.rotation.x = 0;
  for (const x of [-2.96, 2.86]) box(.16, .007, .018, chrome, x, .733, 2.58, .003);
  // Collapse the stationary casting/comb/rods into material batches. Moving keys,
  // spools and carriage keep their own transforms and raycast targets.
  const batches = new Map<string, { material: THREE.Material; shadow: boolean; meshes: THREE.Mesh[] }>();
  for (const object of [...machine.children]) {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) continue;
    const id = `${object.material.uuid}:${object.castShadow}`;
    if (!batches.has(id)) batches.set(id, { material: object.material, shadow: object.castShadow, meshes: [] });
    batches.get(id)!.meshes.push(object);
  }
  const retired = new Set<THREE.BufferGeometry>();
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue;
    const pieces = batch.meshes.map(mesh => { mesh.updateMatrix(); return (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix); });
    const merged = mergeGeometries(pieces);
    if (merged) {
      const mesh = new THREE.Mesh(merged, batch.material); mesh.castShadow = batch.shadow; mesh.receiveShadow = true; machine.add(mesh);
      batch.meshes.forEach(old => { machine.remove(old); retired.add(old.geometry); });
    }
    pieces.forEach(piece => piece.dispose());
  }
  retired.forEach(geometry => geometry.dispose());
  return { machine, carriage, keys, targets, spools, rollers, lever, ribbonLift };
}
