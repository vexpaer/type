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
  private shiftStrokes: number[] = [];
  private bellAt = -10000;
  private lastStrikeAt = -10000;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitScale = 1;
  private orbitDirty = false;
  private orbitPointer: { id: number; x: number; y: number } | null = null;

  constructor(private container: HTMLElement, private onLost: () => void, private onKey?: (key: string) => void, private onBell?: () => void) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.4 : 1.75));
    this.renderer.setClearColor(0x000000, 0); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleLost);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointer); this.renderer.domElement.addEventListener('pointerleave', this.handleLeave); this.renderer.domElement.addEventListener('pointerdown', this.handlePress);
    this.renderer.domElement.addEventListener('pointerup', this.handleRelease); this.renderer.domElement.addEventListener('pointercancel', this.handleRelease);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
    this.renderer.domElement.addEventListener('contextmenu', this.preventContextMenu);
    this.renderer.domElement.addEventListener('dblclick', this.resetOrbit);
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
    if (!this.active) return;
    if (this.orbitPointer?.id === event.pointerId) {
      const dx = event.clientX - this.orbitPointer.x, dy = event.clientY - this.orbitPointer.y;
      this.orbitPointer.x = event.clientX; this.orbitPointer.y = event.clientY;
      this.orbitYaw = THREE.MathUtils.clamp(this.orbitYaw - dx * .005, -.85, .85);
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch - dy * .004, -.36, .42);
      this.orbitDirty = true; this.wake(450); return;
    }
    if (event.pointerType !== 'mouse') return;
    const key = this.pick(event); if (key === this.hovered) return;
    this.hovered = key; this.container.style.cursor = key ? 'pointer' : 'default';
    this.renderer.domElement.title = key ? `Type ${key.value === ' ' ? 'a space' : key.value}` : ''; this.wake(180);
  };
  private handleLeave = () => { this.hovered = null; this.container.style.cursor = ''; this.wake(180); };
  private handlePress = (event: PointerEvent) => {
    if (!this.active || (event.button !== 0 && event.button !== 2)) return;
    const key = event.button === 0 ? this.pick(event) : null;
    if (key) { event.preventDefault(); this.onKey?.(key.value); return; }
    // Drag empty chassis/background to orbit. Right drag also works above the keys.
    event.preventDefault(); this.orbitPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.container.style.cursor = 'grabbing';
  };
  private handleRelease = (event: PointerEvent) => {
    if (this.orbitPointer?.id !== event.pointerId) return;
    this.orbitPointer = null; this.orbitDirty = true;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.container.style.cursor = ''; this.wake(350);
  };
  private handleWheel = (event: WheelEvent) => {
    if (!this.active) return;
    event.preventDefault(); this.orbitScale = THREE.MathUtils.clamp(this.orbitScale * Math.exp(event.deltaY * .001), .77, 1.7);
    this.orbitDirty = true; this.wake(400);
  };
  private preventContextMenu = (event: Event) => event.preventDefault();
  private resetOrbit = () => { this.orbitYaw = 0; this.orbitPitch = 0; this.orbitScale = 1; this.orbitDirty = true; this.wake(450); };
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
    // The bell sounds when the active line enters the right-hand margin, not on Enter.
    if (this.active && performance.now() - this.lastStrikeAt < 220 && caret.line === this.lastCaret.line && this.lastCaret.progress < .86 && caret.progress >= .86) {
      this.bellAt = performance.now(); this.onBell?.();
    }
    this.lastCaret = caret;
    this.carriageTarget = carriageOffset(caret.progress, innerWidth < 600 ? 3.75 : 4.35); this.wake(500);
  }
  strike(value: string, caret: CaretLayout = this.lastCaret, returning = false) {
    if (!this.active) return;
    const now = performance.now();
    const shifted: Record<string, string> = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', ':': ';', '?': '/', '<': ',', '>': '.' };
    const key = this.assembly.keys.get(shifted[value] || value.toLowerCase());
    if (key) { key.strokes.push(now); if (key.strokes.length > 8) key.strokes.shift(); }
    if (value === 'shift' || value === 'shift-right' || value === 'capslock') {
      if (value !== 'capslock') this.shiftStrokes.push(now);
      this.wake(260); return;
    }
    const striking = value !== ' ' && value !== 'backspace' && !returning;
    if (striking) {
      this.lastStrikeAt = now;
      this.strokes.push(now);
      // Only a real matching key moves a bar; IME commits never strike a random slug.
      if (key?.bar) key.bar.strokes.push(now);
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
      // Carriage position is driven by the live caret; an old impact must not pull it backwards.
      if (impact.strike) {
        // At contact the type slug, ribbon and intended print column share X=0.
        // Remove spring lag only at the instant of imprint; the escapement then steps on.
        this.carriagePosition = carriageOffset(impact.caret.progress, innerWidth < 600 ? 3.75 : 4.35);
        this.carriageVelocity = 0;
        this.spoolTarget += .022;
      }
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
      if (key.lever) key.lever.rotation.x = -depression * 1.6;
    }
    for (const bar of a.bars) {
      bar.strokes = bar.strokes.filter(time => now - time < 180);
      bar.group.quaternion.slerpQuaternions(bar.rest, bar.raised, this.reduced.matches ? 0 : overlappingStroke(bar.strokes, now, 'bar'));
    }
    a.syncKeys();
    this.shiftStrokes = this.shiftStrokes.filter(time => now - time < 200);
    a.typeBasket.position.y = this.reduced.matches ? 0 : -overlappingStroke(this.shiftStrokes, now) * .075;
    const bellAge = now - this.bellAt;
    a.bellStriker.rotation.z = !this.reduced.matches && bellAge >= 0 && bellAge < 280 ? Math.sin(bellAge / 280 * Math.PI * 3) * .36 * (1 - bellAge / 280) : 0;
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
    const center = new THREE.Vector3(0, 2.95, -.42);
    const spherical = new THREE.Spherical().setFromVector3(this.fittedPosition.clone().sub(center));
    spherical.theta += this.orbitYaw; spherical.phi = THREE.MathUtils.clamp(spherical.phi + this.orbitPitch, .5, 1.72);
    spherical.radius *= this.orbitScale;
    this.camera.position.copy(center).add(new THREE.Vector3().setFromSpherical(spherical));
    this.camera.position.addScaledVector(this.camera.position.clone().sub(center).normalize(), .65 * (1 - intro) ** 3);
    this.camera.lookAt(center); this.camera.updateMatrixWorld(true);
    a.carriage.position.x = this.carriagePosition; this.paper.update(dt, this.carriagePosition);
    if (this.orbitDirty || this.orbitPointer) {
      const rect = this.container.getBoundingClientRect(); this.paper.layout(rect.width, rect.height, rect);
      this.orbitDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
    const unsettled = Math.abs(this.carriageVelocity) + Math.abs(this.carriageTarget - this.carriagePosition) > .0001;
    if (!this.reduced.matches && (now < this.renderUntil || this.paper.moving || unsettled || this.impacts.length)) this.frame = requestAnimationFrame(this.tick); else this.lastFrame = 0;
  };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); cancelAnimationFrame(this.pendingResize); this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility); this.reduced.removeEventListener('change', this.handleReduced);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleLost);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointer); this.renderer.domElement.removeEventListener('pointerleave', this.handleLeave); this.renderer.domElement.removeEventListener('pointerdown', this.handlePress);
    this.renderer.domElement.removeEventListener('pointerup', this.handleRelease); this.renderer.domElement.removeEventListener('pointercancel', this.handleRelease);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel); this.renderer.domElement.removeEventListener('contextmenu', this.preventContextMenu); this.renderer.domElement.removeEventListener('dblclick', this.resetOrbit);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => { if ((object instanceof THREE.Mesh || object instanceof THREE.Line) && !this.paper.group.getObjectById(object.id)) {
      geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      if (object instanceof THREE.InstancedMesh) object.dispose();
    } });
    this.paper.dispose(); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); this.ownedTextures.forEach(texture => texture.dispose());
    this.environment.dispose(); this.environmentGenerator.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.container.parentElement!.classList.remove('has-3d-paper');
  }
}
