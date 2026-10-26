import * as THREE from 'three';
import { PaperPhysics } from './paper-physics.js';
import { paperSurface } from './materials';

/** A thin shell with a pinned feed edge. Native editing sits on its flat central region. */
export class Paper {
  readonly group = new THREE.Group();
  readonly physics = new PaperPhysics();
  private geometry = new THREE.PlaneGeometry(5.25, 1, 40, 56);
  private material: THREE.MeshStandardMaterial;
  private surface: THREE.Mesh;
  private underside: THREE.Mesh;
  private edge: THREE.Line;
  private edgeGeometry = new THREE.BufferGeometry();
  private height = 3;
  private width = 5.25;
  private anchor = new THREE.Vector3(0, 2.15, -1.81);
  private page = document.getElementById('page')!;
  private dragged = false;
  private lastPointer = new THREE.Vector2();
  private bounds = { width: 1, height: 1, left: 0, top: 0 };
  private leafShift = 0;
  private corners: HTMLButtonElement[] = [];
  private texture: ReturnType<typeof paperSurface>;

  constructor(private camera: THREE.Camera, private wake: () => void, private reduced: MediaQueryList) {
    this.texture = paperSurface();
    this.material = new THREE.MeshStandardMaterial({
      map: this.texture.color, bumpMap: this.texture.bump, bumpScale: .014,
      color: 0xe4d9c3, roughness: .94, metalness: 0, side: THREE.DoubleSide,
    });
    this.surface = new THREE.Mesh(this.geometry, this.material);
    this.surface.castShadow = true; this.surface.receiveShadow = true;
    this.group.add(this.surface);
    this.underside = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial({ map: this.texture.color, color: 0xc8bda4, side: THREE.DoubleSide, roughness: 1 }));
    this.underside.position.z = -.009; this.group.add(this.underside);
    this.edge = new THREE.Line(this.edgeGeometry, new THREE.LineBasicMaterial({ color: 0xc1b394, transparent: true, opacity: .75 }));
    this.group.add(this.edge);
    this.page.style.setProperty('--paper-fibre', `url(${this.texture.url})`);
    for (const side of [-1, 1]) {
      const button = document.createElement('button'); button.className = `paper-corner ${side < 0 ? 'paper-corner-left' : 'paper-corner-right'}`;
      button.setAttribute('aria-label', `Flex ${side < 0 ? 'left' : 'right'} paper corner`);
      button.title = 'Drag to feel the paper';
      button.addEventListener('pointerdown', event => {
        if (this.reduced.matches) return;
        event.preventDefault(); this.dragged = true; this.lastPointer.set(event.clientX, event.clientY); button.setPointerCapture(event.pointerId);
        this.physics.impulse(.9, side); this.wake();
      });
      button.addEventListener('pointermove', event => {
        if (!this.dragged) return;
        const delta = THREE.MathUtils.clamp((event.clientY - this.lastPointer.y) * -.12 + (event.clientX - this.lastPointer.x) * .04, -1.8, 1.8);
        this.physics.impulse(delta, side); this.lastPointer.set(event.clientX, event.clientY); this.wake();
      });
      const release = () => { this.dragged = false; this.wake(); };
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      button.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !this.reduced.matches) { event.preventDefault(); this.physics.impulse(2, side); this.wake(); } });
      this.page.append(button); this.corners.push(button);
    }
  }

  layout(width: number, height: number, rect: DOMRect) {
    this.bounds = { width, height, left: rect.left, top: rect.top };
    this.group.position.copy(this.anchor); this.group.quaternion.copy(this.camera.quaternion); this.group.rotateX(-.045);
    this.group.updateMatrixWorld(true);
    const bottom = this.project(new THREE.Vector3(0, 0, 0));
    const unit = this.project(new THREE.Vector3(0, 1, 0));
    const scale = bottom.y - unit.y;
    // Leave room for the caption and retain readable paper at short viewport heights.
    this.height = Math.max(2.2, (bottom.y - 62) / scale);
    this.width = width < 600 ? Math.min(7.2, (width - 38) / scale) : 5.25;
    this.page.style.width = `${this.width * scale}px`;
    this.page.style.height = `${this.height * scale}px`;
    this.deform(); this.placeEditor();
  }

  strike(column: number, returning: boolean) {
    if (this.reduced.matches) return;
    this.physics.impulse(returning ? 2.7 : .38, returning ? -1 : (column % 11 - 5) / 9);
  }

  update(dt: number, carriage: number) {
    if (this.reduced.matches) this.physics.reset(); else this.physics.step(dt);
    this.leafShift = carriage;
    this.group.position.copy(this.anchor); this.group.position.x += this.leafShift;
    // The page's rigid central reading region follows the same torsion as its text.
    this.group.quaternion.copy(this.camera.quaternion);
    this.group.rotateX(-.045 + this.physics.sample(1) * .055);
    this.group.rotateY(this.physics.twist * .5);
    this.group.rotateZ(this.physics.twist * .15);
    this.deform(); this.placeEditor();
  }

  private deform() {
    const positions = this.geometry.attributes.position as THREE.BufferAttribute;
    const uv = this.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const u = uv.getX(i), t = uv.getY(i), x = (u - .5) * this.width;
      const sides = Math.pow(Math.abs(u - .5) * 2, 10);
      const top = Math.pow(t, 10);
      const curl = sides * (.09 + top * .3) + top * .13 * Math.cos(u * 5);
      const feedCurve = t < .08 ? -.16 * Math.pow(1 - t / .08, 2) : 0;
      const bending = this.physics.sample(t);
      const z = curl + feedCurve + bending * (.28 + sides * .72) + this.physics.twist * x * t * t;
      const edgeIrregularity = sides * Math.sin(t * 117 + u * 3) * .004;
      const rolledCorner = top * sides * (.055 + .055 * Math.sin(u * 5));
      positions.setXYZ(i, x + Math.sign(x) * edgeIrregularity, t * this.height - bending * bending * .22 - rolledCorner, z);
    }
    positions.needsUpdate = true; this.geometry.computeVertexNormals(); this.geometry.computeBoundingSphere();
    const edgePoints: THREE.Vector3[] = [];
    // PlaneGeometry's first row is the free top edge; include both side edges.
    for (let row = 56; row >= 0; row--) edgePoints.push(new THREE.Vector3().fromBufferAttribute(positions, row * 41));
    for (let col = 1; col <= 40; col++) edgePoints.push(new THREE.Vector3().fromBufferAttribute(positions, col));
    for (let row = 1; row <= 56; row++) edgePoints.push(new THREE.Vector3().fromBufferAttribute(positions, row * 41 + 40));
    this.edgeGeometry.setFromPoints(edgePoints);
  }

  private project(point: THREE.Vector3) {
    const p = this.group.localToWorld(point).project(this.camera);
    return new THREE.Vector2((p.x + 1) * this.bounds.width / 2, (1 - p.y) * this.bounds.height / 2);
  }

  private placeEditor() {
    this.group.updateMatrixWorld(true);
    const origin = this.project(new THREE.Vector3(-this.width / 2, this.height, .025));
    const x = this.project(new THREE.Vector3(this.width / 2, this.height, .025));
    const y = this.project(new THREE.Vector3(-this.width / 2, 0, .025));
    const room = this.page.parentElement!.getBoundingClientRect();
    const w = parseFloat(this.page.style.width), h = parseFloat(this.page.style.height);
    this.page.style.transform = `matrix(${(x.x - origin.x) / w},${(x.y - origin.y) / w},${(y.x - origin.x) / h},${(y.y - origin.y) / h},${origin.x + this.bounds.left - room.left},${origin.y + this.bounds.top - room.top})`;
  }

  get moving() { return this.physics.moving || this.dragged; }
  releaseEditorLayout() {
    this.page.style.removeProperty('width'); this.page.style.removeProperty('height'); this.page.style.removeProperty('transform');
  }
  dispose() {
    this.corners.forEach(button => button.remove());
    this.geometry.dispose(); this.edgeGeometry.dispose(); this.material.dispose();
    (this.underside.material as THREE.Material).dispose(); (this.edge.material as THREE.Material).dispose();
    this.texture.color.dispose(); this.texture.bump.dispose();
    this.releaseEditorLayout();
  }
}
