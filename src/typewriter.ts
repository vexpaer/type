import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Paper } from './paper';
import { deskSurface } from './materials';
import { buildMachine, type MovingKey } from './machine';

export class Typewriter {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private assembly: ReturnType<typeof buildMachine>;
  private observer: ResizeObserver;
  private paper: Paper;
  private frame = 0;
  private active = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private strikeAt = -10000;
  private returnAt = -10000;
  private carriageTarget = 0;
  private carriagePosition = 0;
  private carriageVelocity = 0;
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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.5 : 1.75));
    this.renderer.setClearColor(0x000000, 0); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleLost);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointer); this.renderer.domElement.addEventListener('pointerleave', this.handleLeave); this.renderer.domElement.addEventListener('pointerdown', this.handlePress);
    container.append(this.renderer.domElement);
    this.environmentGenerator = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(); this.environment = this.environmentGenerator.fromScene(room, .035); room.dispose();
    this.scene.environment = this.environment.texture; this.scene.environmentIntensity = .6;
    this.camera.position.set(0, 9.5, 12.8); this.camera.lookAt(0, 1, -.1);
    this.scene.add(new THREE.HemisphereLight(0xffeed5, 0x342b27, 2));
    const key = new THREE.DirectionalLight(0xffe3ba, 3.6); key.position.set(-5, 10, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 10, bottom: -7, near: .5, far: 35 });
    key.shadow.normalBias = .015; key.shadow.bias = -.00015; key.shadow.radius = 3; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc8d9ea, 2.1); rim.position.set(5, 6, -4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffdbc2, .6); fill.position.set(0, 3, 8); this.scene.add(fill);
    this.assembly = buildMachine(this.own); this.scene.add(this.assembly.machine);
    const desk = this.own(deskSurface());
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: desk, roughness: .89, color: 0x88796d }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.15; floor.receiveShadow = true; this.scene.add(floor);
    this.paper = new Paper(this.camera, () => this.wake(2200), this.reduced); this.scene.add(this.paper.group);
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
    return hit ? hit.object.userData.key as MovingKey : null;
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
    const viewWidth = rect.width < 600 ? 9.5 : Math.max(10.2, rect.width * 6.3 / Math.max(360, rect.height - 90));
    const viewHeight = viewWidth * rect.height / rect.width;
    this.camera.left = -viewWidth / 2; this.camera.right = viewWidth / 2;
    const bottom = 2.03 + 28 * viewWidth / rect.width;
    this.camera.top = viewHeight - bottom; this.camera.bottom = -bottom;
    this.camera.near = .1; this.camera.far = 300; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.renderer.setSize(rect.width, rect.height, false); this.paper.layout(rect.width, rect.height, rect);
    this.container.parentElement!.classList.add('has-3d-paper'); this.wake(500);
  }
  setActive(active: boolean) {
    this.active = active; this.container.parentElement!.classList.toggle('has-3d-paper', active);
    if (active) { this.resize(); this.wake(600); }
    else { cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0; this.paper.releaseEditorLayout(); }
  }
  strike(value: string, column: number, returning = false) {
    if (!this.active) return;
    const now = performance.now();
    const shifted: Record<string, string> = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', ':': ';', '?': '/', '<': ',', '>': '.' };
    const key = this.assembly.keys.get(shifted[value] || value.toLowerCase());
    if (key) key.pressedAt = now;
    if (value === 'shift' || value === 'shift-right' || value === 'capslock') { this.wake(260); return; }
    if (!key && !returning) { const fallback = [...this.assembly.keys.values()].filter(k => k.bar)[column % 44]; fallback.pressedAt = now; }
    if (value !== ' ' && value !== 'backspace') this.strikeAt = now;
    this.carriageTarget = -Math.min(column, 72) / 72 * .5;
    if (returning) { this.returnAt = now; this.carriageTarget = 0; }
    this.paper.strike(column, returning); this.wake(returning ? 2400 : 1600);
  }
  private wake(duration = 300) {
    this.renderUntil = Math.max(this.renderUntil, performance.now() + duration);
    if (this.active && !this.frame && !document.hidden && !this.disposed) this.frame = requestAnimationFrame(this.tick);
  }
  private tick = (now: number) => {
    this.frame = 0; if (!this.active || this.disposed) return;
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, .05) : 1 / 60; this.lastFrame = now;
    const a = this.assembly;
    if (!this.reduced.matches) {
      for (const key of a.keys.values()) {
        const t = (now - key.pressedAt) / 210;
        const depression = t >= 0 && t < 1 ? Math.sin(Math.min(t / .32, 1) * Math.PI / 2) * Math.pow(1 - t, 1.4) * .19 : 0;
        key.group.position.y = key.rest - depression + (this.hovered === key ? .012 : 0); key.group.rotation.x = depression * -.25;
        if (key.bar) key.bar.rotation.x = t > .05 && t < .76 ? -Math.sin((t - .05) / .71 * Math.PI) * 1.05 : 0;
      }
      const stroke = (now - this.strikeAt) / 150;
      a.ribbonLift.position.y = 1.92 + (stroke >= 0 && stroke < 1 ? Math.sin(stroke * Math.PI) * .08 : 0);
      if (stroke >= 0 && stroke < 1) a.spools.forEach((spool, i) => spool.rotation.y += dt * (i ? -.65 : .65));
      const returning = (now - this.returnAt) / 420;
      a.lever.rotation.y = returning >= 0 && returning < 1 ? Math.sin(returning * Math.PI) * -.32 : 0;
      if (returning >= 0 && returning < 1) a.rollers.forEach(roller => roller.rotation.x += dt * 1.5);
      const steps = Math.ceil(dt / .008), step = dt / steps;
      for (let i = 0; i < steps; i++) { this.carriageVelocity += ((this.carriageTarget - this.carriagePosition) * 160 - this.carriageVelocity * 23) * step; this.carriagePosition += this.carriageVelocity * step; }
    } else {
      this.carriagePosition = this.carriageTarget; this.carriageVelocity = 0;
      for (const key of a.keys.values()) { key.group.position.y = key.rest; key.group.rotation.x = 0; if (key.bar) key.bar.rotation.x = 0; }
      a.ribbonLift.position.y = 1.92; a.lever.rotation.y = 0;
    }
    a.carriage.position.x = this.carriagePosition; this.paper.update(dt, this.carriagePosition); this.renderer.render(this.scene, this.camera);
    if (!this.reduced.matches && (now < this.renderUntil || this.paper.moving)) this.frame = requestAnimationFrame(this.tick); else this.lastFrame = 0;
  };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); cancelAnimationFrame(this.pendingResize); this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility); this.reduced.removeEventListener('change', this.handleReduced);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleLost);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointer); this.renderer.domElement.removeEventListener('pointerleave', this.handleLeave); this.renderer.domElement.removeEventListener('pointerdown', this.handlePress);
    this.paper.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh && !this.paper.group.getObjectById(object.id)) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); this.ownedTextures.forEach(texture => texture.dispose());
    this.environment.dispose(); this.environmentGenerator.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); this.container.parentElement!.classList.remove('has-3d-paper');
  }
}
