import * as THREE from 'three';
import { PaperPhysics } from './paper-physics.js';
import { quadMatrix } from './mechanics.js';
import { paperSurface } from './materials';
import { PAPER_ANCHOR, PAPER_HEIGHT, PAPER_WIDTH, PAPER_TILT, PAPER_READING_BOTTOM } from './scene-layout';

/** Fixed paper dimensions, an actual platen wrap, and a planar native editing region. */
export class Paper {
  readonly group = new THREE.Group();
  readonly physics = new PaperPhysics();
  private geometry = new THREE.PlaneGeometry(PAPER_WIDTH, 1, 40, 56);
  private edgeGeometry = new THREE.BufferGeometry();
  private material: THREE.MeshStandardMaterial;
  private undersideMaterial: THREE.MeshStandardMaterial;
  private edgeMaterial = new THREE.LineBasicMaterial({ color: 0xd7cfbb, transparent: true, opacity: .42 });
  private page = document.getElementById('page')!;
  private dragged = false;
  private lastPointer = new THREE.Vector2();
  private bounds = { width: 1, height: 1, left: 0, top: 0 };
  private corners: HTMLButtonElement[] = [];
  private texture: ReturnType<typeof paperSurface>;
  private editorWidth = 1;
  private editorHeight = 1;
  private feed = 0;
  private feedVelocity = 0;

  constructor(private camera: THREE.Camera, private wake: () => void, private reduced: MediaQueryList) {
    this.texture = paperSurface();
    this.material = new THREE.MeshStandardMaterial({ map: this.texture.color, bumpMap: this.texture.bump, bumpScale: .004, color: 0xffffff, roughness: .96, metalness: 0, side: THREE.FrontSide });
    this.undersideMaterial = new THREE.MeshStandardMaterial({ map: this.texture.color, color: 0xe1d8c2, side: THREE.BackSide, roughness: 1 });
    const surface = new THREE.Mesh(this.geometry, this.material); surface.castShadow = surface.receiveShadow = true; this.group.add(surface);
    const underside = new THREE.Mesh(this.geometry, this.undersideMaterial); underside.position.z = -.004; this.group.add(underside);
    this.group.add(new THREE.Line(this.edgeGeometry, this.edgeMaterial));
    this.group.position.copy(PAPER_ANCHOR); this.group.rotation.x = PAPER_TILT;
    this.page.style.setProperty('--paper-fibre', `url(${this.texture.url})`);
    for (const side of [-1, 1]) {
      const button = document.createElement('button'); button.className = `paper-corner ${side < 0 ? 'paper-corner-left' : 'paper-corner-right'}`;
      button.setAttribute('aria-label', `Flex ${side < 0 ? 'left' : 'right'} paper corner`); button.title = 'Drag to feel the paper';
      button.addEventListener('pointerdown', event => {
        if (this.reduced.matches) return;
        event.preventDefault(); this.dragged = true; this.lastPointer.set(event.clientX, event.clientY); button.setPointerCapture(event.pointerId);
        this.physics.impulse(.7, side); this.wake();
      });
      button.addEventListener('pointermove', event => {
        if (!this.dragged) return;
        const delta = THREE.MathUtils.clamp((event.clientY - this.lastPointer.y) * -.08 + (event.clientX - this.lastPointer.x) * .025, -1.3, 1.3);
        this.physics.impulse(delta, side); this.lastPointer.set(event.clientX, event.clientY); this.wake();
      });
      const release = () => { this.dragged = false; this.wake(); };
      button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      button.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !this.reduced.matches) { event.preventDefault(); this.physics.impulse(1.4, side); this.wake(); } });
      this.page.append(button); this.corners.push(button);
    }
    this.deform();
  }

  layout(width: number, height: number, rect: DOMRect) {
    this.bounds = { width, height, left: rect.left, top: rect.top };
    this.group.updateMatrixWorld(true);
    const topLeft = this.project(new THREE.Vector3(-PAPER_WIDTH / 2, PAPER_HEIGHT, 0));
    const topRight = this.project(new THREE.Vector3(PAPER_WIDTH / 2, PAPER_HEIGHT, 0));
    const bottomLeft = this.project(new THREE.Vector3(-PAPER_WIDTH / 2, PAPER_READING_BOTTOM, 0));
    this.editorWidth = topLeft.distanceTo(topRight); this.editorHeight = topLeft.distanceTo(bottomLeft);
    // Stable local pixels let native wrapping and caret measurements share one coordinate space.
    this.page.style.width = `${this.editorWidth}px`; this.page.style.height = `${this.editorHeight}px`;
    this.placeEditor();
  }

  strike(progress: number, returning: boolean) {
    if (this.reduced.matches) return;
    this.physics.impulse(returning ? 1.25 : .13, returning ? -.25 : (progress - .5) * .3);
    if (returning) this.feedVelocity += .2;
  }

  update(dt: number, carriage: number) {
    if (this.reduced.matches) { this.physics.reset(); this.feed = this.feedVelocity = 0; }
    else {
      this.physics.step(dt);
      const steps = Math.max(1, Math.ceil(dt / .008)), step = dt / steps;
      for (let i = 0; i < steps; i++) { this.feedVelocity += (-100 * this.feed - 19 * this.feedVelocity) * step; this.feed += this.feedVelocity * step; }
    }
    this.group.position.copy(PAPER_ANCHOR); this.group.position.x += carriage;
    this.group.position.y += this.feed;
    // Keep the central editing plane rigid; vibration belongs to the free edges.
    this.group.rotation.set(PAPER_TILT, 0, 0);
    this.deform(); this.placeEditor();
  }

  private deform() {
    const positions = this.geometry.attributes.position as THREE.BufferAttribute, uv = this.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const u = uv.getX(i), t = uv.getY(i), x = (u - .5) * PAPER_WIDTH;
      const y = -.24 + t * (PAPER_HEIGHT + .24), side = Math.pow(Math.abs(u - .5) * 2, 14), top = Math.pow(t, 18);
      const wrap = y < 0 ? -.264 + Math.sqrt(Math.max(0, .264 ** 2 - y ** 2)) : 0;
      const curl = side * t * t * (.022 + top * (u < .5 ? .07 : .12));
      const bending = this.physics.sample(t) * (side * .5 + top * .035);
      const twist = this.physics.twist * x * t * t * side * .22;
      positions.setXYZ(i, x + Math.sign(x) * side * Math.sin(t * 85) * .0012, y, wrap + curl + bending + twist);
    }
    positions.needsUpdate = true; this.geometry.computeVertexNormals(); this.geometry.computeBoundingSphere();
    const edgePoints: THREE.Vector3[] = [];
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
    const room = this.page.parentElement!.getBoundingClientRect();
    const points = [new THREE.Vector3(-PAPER_WIDTH / 2, PAPER_HEIGHT, .009), new THREE.Vector3(PAPER_WIDTH / 2, PAPER_HEIGHT, .009),
      new THREE.Vector3(PAPER_WIDTH / 2, PAPER_READING_BOTTOM, .009), new THREE.Vector3(-PAPER_WIDTH / 2, PAPER_READING_BOTTOM, .009)]
      .map(point => { const p = this.project(point); return { x: p.x + this.bounds.left - room.left, y: p.y + this.bounds.top - room.top }; });
    const matrix = quadMatrix(this.editorWidth, this.editorHeight, points);
    this.page.style.transform = `matrix3d(${matrix.join(',')})`;
  }

  get moving() { return this.physics.moving || this.dragged || Math.abs(this.feed) + Math.abs(this.feedVelocity) > .0001; }
  releaseEditorLayout() { ['width', 'height', 'transform'].forEach(property => this.page.style.removeProperty(property)); }
  dispose() {
    this.corners.forEach(button => button.remove()); this.geometry.dispose(); this.edgeGeometry.dispose();
    this.material.dispose(); this.undersideMaterial.dispose(); this.edgeMaterial.dispose(); this.texture.color.dispose(); this.texture.bump.dispose(); this.releaseEditorLayout();
  }
}
