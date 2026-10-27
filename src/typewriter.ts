import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Paper } from './paper';
import { deskSurface } from './materials';
import { buildMachine, type MovingKey } from './machine';
import { advanceKey, carriageOffset, overlappingStroke, IMPACT_MS } from './mechanics.js';
import { fitCamera } from './scene-layout';

export type CaretLayout = { progress: number; line: number };
type Impact = { at: number; caret: CaretLayout; feed: boolean; strike: boolean };

export class Typewriter {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private fittedPosition = new THREE.Vector3();
  private entranceAt = -10000;
  private assembly: ReturnType<typeof buildMachine>;
  private observer: ResizeObserver;
  private paper: Paper;
  private frame = 0;
  private active = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private returnAt = -10000;
  private strokes: number[] = [];
  private impacts: Impact[] = [];
  private lastCaret: CaretLayout = { progress: 0, line: 0 };
  private carriageTarget = 0;
  private carriagePosition = 0;
  private carriageVelocity = 0;
  private spoolAngle = 0;
  private spoolTarget = 0;
  private rollerAngle = 0;
  private rollerTarget = 0;
  private disposed = false;
  private environment: THREE.WebGLRenderTarget;
  private environmentGenerator: THREE.PMREMGenerator;
  private renderUntil = 0;
  private lastFrame = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: MovingKey | null = null;
  private ownedTextures = new Set<THREE.Texture>();
  private pendingResize = 0;

  constructor(private container: HTMLElement, private onLost: () => void, private onKey?: (key: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.4 : 1.75));
    this.renderer.setClearColor(0x000000, 0); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleLost);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointer); this.renderer.domElement.addEventListener('pointerleave', this.handleLeave); this.renderer.domElement.addEventListener('pointerdown', this.handlePress);
    container.append(this.renderer.domElement);
    this.environmentGenerator = new THREE.PMREMGenerator(this.renderer);
    // Reflection cards match the large, warm window and restrained cool fill in the scene.
    const studio = new THREE.Scene(); studio.background = new THREE.Color(0x333733);
    const cards: THREE.Mesh[] = [];
    for (const [x, y, z, w, h, intensity] of [[-5, 7, 5, 6, 8, 4], [5, 4, -3, 3, 5, 1.3], [0, 9, -2, 7, 3, 1.6]]) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity * .96, intensity * .88), side: THREE.DoubleSide }));
      card.position.set(x, y, z); card.lookAt(0, 1, 0); studio.add(card); cards.push(card);
    }
    this.environment = this.environmentGenerator.fromScene(studio, .065);
    cards.forEach(card => { card.geometry.dispose(); (card.material as THREE.Material).dispose(); });
    this.scene.environment = this.environment.texture; this.scene.environmentIntensity = .48;
    RectAreaLightUniformsLib.init();
    const windowLight = new THREE.RectAreaLight(0xffead1, 4, 6, 7); windowLight.position.set(-4.5, 7, 5); windowLight.lookAt(0, 1, 0); this.scene.add(windowLight);
    this.scene.add(new THREE.HemisphereLight(0xefe6d7, 0x27251f, .55));
    const key = new THREE.DirectionalLight(0xffecd3, 1.35); key.position.set(-5, 10, 6); key.castShadow = true;
    key.shadow.mapSize.set(innerWidth < 600 ? 1024 : 2048, innerWidth < 600 ? 1024 : 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 10, bottom: -5, near: .5, far: 30 });
    key.shadow.normalBias = .012; key.shadow.bias = -.00012; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbe5ef, .38); fill.position.set(4, 4, -3); this.scene.add(fill);
    this.assembly = buildMachine(this.own); this.scene.add(this.assembly.machine);
    const desk = this.own(deskSurface());
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: desk, roughness: .87, color: 0x99928a }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.12; floor.receiveShadow = true; this.scene.add(floor);
    this.paper = new Paper(this.camera, () => this.wake(1800), this.reduced); this.scene.add(this.paper.group);
    this.observer = new ResizeObserver(() => { cancelAnimationFrame(this.pendingResize); this.pendingResize = requestAnimationFrame(() => this.resize()); }); this.observer.observe(container);
    document.addEventListener('visibilitychange', this.handleVisibility); this.reduced.addEventListener('change', this.handleReduced);
    this.container.dataset.renderer = 'webgl';
  }
  private own = <T extends THREE.Texture>(texture: T): T => { this.ownedTextures.add(texture); return texture; };
  private handleLost = (event: Event) => { event.preventDefault(); this.setActive(false); this.onLost(); };
  private handleVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0; }
    else if (this.active) this.wake();
  };
  private handleReduced = () => { this.paper.physics.reset(); this.wake(); };
  private pick(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.assembly.targets, false)[0];
    if (!hit) return null;
    return (hit.instanceId === undefined ? hit.object.userData.key : hit.object.userData.keys[hit.instanceId]) as MovingKey;
  }
  private handlePointer = (event: PointerEvent) => {
    if (!this.active || event.pointerType !== 'mouse') return;
    const key = this.pick(event); if (key === this.hovered) return;
    this.hovered = key; this.container.style.cursor = key ? 'pointer' : 'default';
    this.renderer.domElement.title = key ? `Type ${key.value === ' ' ? 'a space' : key.value}` : ''; this.wake(180);
  };
  private handleLeave = () => { this.hovered = null; this.container.style.cursor = ''; this.wake(180); };
  private handlePress = (event: PointerEvent) => {
    if (!this.active || event.button !== 0) return;
    const key = this.pick(event); if (!key) return;
    event.preventDefault(); this.onKey?.(key.value);
  };
  private resize() {
    if (this.disposed || !this.active) return;
    const rect = this.container.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    fitCamera(this.camera, rect.width, rect.height); this.fittedPosition.copy(this.camera.position);
    this.renderer.setSize(rect.width, rect.height, false); this.paper.layout(rect.width, rect.height, rect);
    this.container.parentElement!.classList.add('has-3d-paper'); this.wake(500);
  }
  setActive(active: boolean) {
    const entering = active && !this.active;
    this.active = active; this.container.parentElement!.classList.toggle('has-3d-paper', active);
    if (active) { if (entering) this.entranceAt = performance.now(); this.resize(); this.wake(750); }
    else { cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0; this.paper.releaseEditorLayout(); }
  }
  syncCaret(caret: CaretLayout) {
    this.lastCaret = caret; this.impacts.forEach(impact => { impact.caret = caret; });
    this.carriageTarget = carriageOffset(caret.progress, innerWidth < 600 ? .24 : .7); this.wake(500);
  }
  strike(value: string, caret: CaretLayout = this.lastCaret, returning = false) {
    if (!this.active) return;
    const now = performance.now();
    const shifted: Record<string, string> = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', ':': ';', '?': '/', '<': ',', '>': '.' };
    const key = this.assembly.keys.get(shifted[value] || value.toLowerCase());
    if (key) { key.strokes.push(now); if (key.strokes.length > 8) key.strokes.shift(); }
    if (value === 'shift' || value === 'shift-right' || value === 'capslock') { this.wake(260); return; }
    const striking = value !== ' ' && value !== 'backspace' && !returning;
    if (striking) {
      this.strokes.push(now);
      // Composition/non-Latin input animates the print mechanism without inventing a letter key.
      const bar = key?.bar || this.assembly.bars[22]; bar.strokes.push(now);
    }
    const feed = returning || caret.line > this.lastCaret.line;
    if (returning) this.returnAt = now;
    this.impacts.push({ at: now + (returning ? 90 : IMPACT_MS), caret, feed, strike: striking });
    this.lastCaret = caret; this.wake(returning ? 1600 : 1000);
  }
  private wake(duration = 300) {
    this.renderUntil = Math.max(this.renderUntil, performance.now() + duration);
    if (this.active && !this.frame && !document.hidden && !this.disposed) this.frame = requestAnimationFrame(this.tick);
  }
  private tick = (now: number) => {
    this.frame = 0; if (!this.active || this.disposed) return;
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, .05) : 1 / 60; this.lastFrame = now;
    const a = this.assembly;
    for (const impact of this.impacts.filter(impact => impact.at <= now || this.reduced.matches)) {
      this.carriageTarget = carriageOffset(impact.caret.progress, innerWidth < 600 ? .24 : .7);
      if (impact.strike) this.spoolTarget += .022;
      if (impact.feed) this.rollerTarget -= .19;
      this.paper.strike(impact.caret.progress, impact.feed);
    }
    this.impacts = this.reduced.matches ? [] : this.impacts.filter(impact => impact.at > now);
    this.strokes = this.strokes.filter(time => now - time < 180);
    for (const key of a.keys.values()) {
      key.strokes = key.strokes.filter(time => now - time < 200);
      const depression = this.reduced.matches ? 0 : advanceKey(key.spring, overlappingStroke(key.strokes, now) * .105, dt);
      if (this.reduced.matches) key.spring.position = key.spring.velocity = 0;
      key.group.position.y = key.rest - depression + (this.hovered === key && !this.reduced.matches ? .008 : 0); key.group.rotation.x = depression * -.2;
    }
    for (const bar of a.bars) {
      bar.strokes = bar.strokes.filter(time => now - time < 180);
      bar.group.quaternion.slerpQuaternions(bar.rest, bar.raised, this.reduced.matches ? 0 : overlappingStroke(bar.strokes, now, 'bar'));
    }
    a.syncKeys();
    a.ribbonLift.position.y = 1.91 + (this.reduced.matches ? 0 : overlappingStroke(this.strokes, now, 'ribbon') * .12);
    const returning = (now - this.returnAt) / 420;
    a.lever.rotation.y = !this.reduced.matches && returning >= 0 && returning < 1 ? Math.sin(returning * Math.PI) * -.3 : 0;
    if (this.reduced.matches) {
      this.carriagePosition = this.carriageTarget; this.carriageVelocity = 0; this.spoolAngle = this.spoolTarget; this.rollerAngle = this.rollerTarget;
    } else {
      const steps = Math.max(1, Math.ceil(dt / .008)), step = dt / steps;
      for (let i = 0; i < steps; i++) { this.carriageVelocity += ((this.carriageTarget - this.carriagePosition) * 170 - this.carriageVelocity * 25) * step; this.carriagePosition += this.carriageVelocity * step; }
      this.spoolAngle = THREE.MathUtils.damp(this.spoolAngle, this.spoolTarget, 17, dt);
      this.rollerAngle = THREE.MathUtils.damp(this.rollerAngle, this.rollerTarget, 13, dt);
    }
    a.spools.forEach((spool, i) => { spool.rotation.y = this.spoolAngle * (i ? -1 : 1); });
    a.rollers.forEach(roller => { roller.rotation.x = this.rollerAngle; });
    const intro = this.reduced.matches ? 1 : THREE.MathUtils.clamp((now - this.entranceAt) / 700, 0, 1);
    this.camera.position.copy(this.fittedPosition).addScaledVector(this.fittedPosition.clone().sub(new THREE.Vector3(0, 2.95, -.42)).normalize(), .65 * (1 - intro) ** 3);
    this.camera.updateMatrixWorld(true);
    a.carriage.position.x = this.carriagePosition; this.paper.update(dt, this.carriagePosition); this.renderer.render(this.scene, this.camera);
    const unsettled = Math.abs(this.carriageVelocity) + Math.abs(this.carriageTarget - this.carriagePosition) > .0001;
    if (!this.reduced.matches && (now < this.renderUntil || this.paper.moving || unsettled || this.impacts.length)) this.frame = requestAnimationFrame(this.tick); else this.lastFrame = 0;
  };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); cancelAnimationFrame(this.pendingResize); this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility); this.reduced.removeEventListener('change', this.handleReduced);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleLost);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointer); this.renderer.domElement.removeEventListener('pointerleave', this.handleLeave); this.renderer.domElement.removeEventListener('pointerdown', this.handlePress);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => { if ((object instanceof THREE.Mesh || object instanceof THREE.Line) && !this.paper.group.getObjectById(object.id)) {
      geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      if (object instanceof THREE.InstancedMesh) object.dispose();
    } });
    this.paper.dispose(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); this.ownedTextures.forEach(texture => texture.dispose());
    this.environment.dispose(); this.environmentGenerator.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.container.parentElement!.classList.remove('has-3d-paper');
  }
}
