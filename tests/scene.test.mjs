import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise real production geometry in Node; the canvas stub supplies texture storage only.
const root = fileURLToPath(new URL('..', import.meta.url));
mkdirSync(join(root, '.qa'), { recursive: true });
const compiled = mkdtempSync(join(root, '.qa', 'scene-'));
for (const name of ['machine', 'materials', 'scene-layout']) {
  const source = readFileSync(join(root, 'src', name + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replaceAll("'./materials'", "'./materials.js'").replaceAll("'./mechanics.js'", "'../../src/mechanics.js'");
  writeFileSync(join(compiled, name + '.js'), js);
}
after(() => rmSync(compiled, { recursive: true, force: true }));
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => ({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, fillRect() {}, clearRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {},
  createRadialGradient: () => ({ addColorStop() {} }),
}) }) };
const { buildMachine } = await import(pathToFileURL(join(compiled, 'machine.js')));
const { fitCamera, PAPER_WIDTH, PAPER_HEIGHT, PAPER_ANCHOR, PAPER_TILT, PAPER_READING_BOTTOM } = await import(pathToFileURL(join(compiled, 'scene-layout.js')));
const assembly = buildMachine(texture => texture);
assembly.machine.updateMatrixWorld(true);

test('every type slug meets the shared strike point from a distinct physical pivot', () => {
  const pivots = new Set();
  for (const bar of assembly.bars) {
    pivots.add(bar.group.position.toArray().map(n => n.toFixed(5)).join(','));
    let tip = new THREE.Vector3();
    const body = bar.group.children.find(child => {
      if (!(child instanceof THREE.Mesh)) return false;
      child.geometry.computeBoundingBox();
      return child.geometry.boundingBox.max.y - child.geometry.boundingBox.min.y > .3;
    });
    assert.ok(body, 'each engraved typebar retains its full-length steel arm');
    const geometry = body.geometry;
    // The batched rod + slug reaches its end along local Y.
    tip.set(0, geometry.boundingBox.max.y, 0).applyQuaternion(bar.raised).add(bar.group.position);
    assert.ok(tip.distanceTo(new THREE.Vector3(0, 2.038, -1.556)) < .011);
  }
  assert.equal(pivots.size, assembly.bars.length);
});

test('the entire assembly is finite and batched keys retain individual raycast identities', () => {
  assembly.machine.traverse(object => {
    if (object.geometry) {
      assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
      object.geometry.computeBoundingBox();
      assert.ok(!object.geometry.boundingBox.isEmpty());
    }
  });
  const caps = assembly.targets.find(object => object instanceof THREE.InstancedMesh);
  assert.ok(caps && caps.count === 45);
  const key = assembly.keys.get('a');
  const ray = new THREE.Raycaster(new THREE.Vector3(key.group.position.x, 8, key.group.position.z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObjects(assembly.targets, false)[0];
  assert.equal(hit.object.userData.keys[hit.instanceId].value, 'a');
});

test('mirrored cheeks keep outward-facing winding after static batching', () => {
  const castings = [];
  assembly.machine.traverse(object => { if (object.name === 'enamel-casting') castings.push(object); });
  assert.ok(castings.length > 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (const mesh of castings) {
    const { position, normal: normals } = mesh.geometry.attributes;
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
      const face = b.sub(a).cross(c.sub(a));
      normal.fromBufferAttribute(normals, i);
      assert.ok(face.dot(normal) >= -1e-7, 'a mirrored face was baked inside-out');
    }
  }
});

test('camera fitting keeps the physical paper readable and in frame at responsive sizes', () => {
  for (const [width, height] of [[1060, 822], [1060, 596], [768, 820], [390, 660], [320, 550]]) {
    const camera = new THREE.PerspectiveCamera(); fitCamera(camera, width, height);
    const project = (x, y) => new THREE.Vector3(x, y, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), PAPER_TILT).add(PAPER_ANCHOR).project(camera);
    const left = project(-PAPER_WIDTH / 2, PAPER_HEIGHT), right = project(PAPER_WIDTH / 2, PAPER_HEIGHT);
    const travel = width < 600 ? .12 : .35;
    for (const x of [-PAPER_WIDTH / 2 - travel, PAPER_WIDTH / 2 + travel]) for (const y of [PAPER_READING_BOTTOM, PAPER_HEIGHT]) {
      const p = project(x, y); assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `${width} × ${height}: paper clipped`);
    }
    assert.ok((right.x - left.x) * width / 2 > (width < 600 ? 245 : 310), `${width} × ${height}: paper too narrow`);
  }
});

test('the engraved basket, articulated key levers and carriage bell are independent physical pieces', () => {
  assert.equal(assembly.bars.length, 44);
  assert.ok(assembly.bars.every(bar => bar.group.parent === assembly.typeBasket));
  assert.ok(assembly.keys.get('a').lever);
  assert.ok(assembly.keys.get('a').bar);
  assert.ok(assembly.bellStriker.parent.parent === assembly.carriage);
  assert.equal(assembly.keys.get(' ').bar, null);
});
