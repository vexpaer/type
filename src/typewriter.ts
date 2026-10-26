import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGRenderer, SVGObject } from 'three/addons/renderers/SVGRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface MovingKey { group: THREE.Group; rest: number; pressedAt: number; }
/** An original procedural model: all the enamel, chrome, keys and working parts are meshes. */
export class Typewriter {
  private renderer: THREE.WebGLRenderer | SVGRenderer;
  private software = false;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private machine = new THREE.Group();
  private carriage = new THREE.Group();
  private keys = new Map<string, MovingKey>();
  private hammer = new THREE.Group();
  private reels: THREE.Mesh[] = [];
  private lever = new THREE.Group();
  private observer: ResizeObserver;
  private frame = 0;
  private active = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private strikeAt = -1000;
  private returnAt = -1000;
  private carriageTarget = 0;
  private carriagePosition = 0;
  private pointer = new THREE.Vector2();
  private disposed = false;
  private environment?: THREE.WebGLRenderTarget;
  private renderUntil = 0;
  private width = 1;
  private height = 1;
  private needsRender = true;
  private softwareKeys = new Map<string, SVGGElement>();
  private envGenerator?: THREE.PMREMGenerator;
  constructor(private container: HTMLElement, private onLost: () => void) {
    try {
      // Detect support before constructing a renderer, so software-only browsers stay quiet.
      const probe = document.createElement('canvas');
      const context = probe.getContext('webgl2');
      if (!context) throw new Error('WebGL2 unavailable');
      context.getExtension('WEBGL_lose_context')?.loseContext();
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      this.renderer = renderer;
      renderer.domElement.addEventListener('webglcontextlost', this.handleLost);
      this.envGenerator = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      this.environment = this.envGenerator.fromScene(room, .04);
      room.dispose();
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = .65;
    } catch {
      this.software = true;
      const renderer = new SVGRenderer();
      renderer.setPrecision(2);renderer.setQuality('low');
      this.renderer = renderer;
      this.container.classList.add('software-renderer');
    }
    container.append(this.renderer.domElement);
    this.camera.position.set(0, 8.5, 11.5);
    this.camera.lookAt(0, .65, -.1);
    if(this.software) this.scene.add(new THREE.AmbientLight(0xffecd0, .9));
    else this.scene.add(new THREE.HemisphereLight(0xffecd0, 0x30251c, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffead0, this.software ? 1 : 4.5); keyLight.position.set(-4, 9, 5); keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.camera.left = -6; keyLight.shadow.camera.right = 6; keyLight.shadow.camera.top = 6; keyLight.shadow.camera.bottom = -6; keyLight.shadow.normalBias = .025; keyLight.shadow.bias = -.0004; keyLight.shadow.radius = 4;
    this.scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0xdce9ed, this.software ? .4 : 1.8); rim.position.set(5, 5, -4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd3a0, this.software ? .2 : .8); fill.position.set(0, 1, 7); this.scene.add(fill);
    this.scene.add(this.machine);
    this.build();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .34 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.09; floor.receiveShadow = true; if(!this.software)this.scene.add(floor);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
    window.addEventListener('pointermove', this.handlePointer, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.resize();
  }
  private handleLost = (event: Event) => { event.preventDefault(); this.setActive(false); this.onLost(); };
  private handlePointer = (event: PointerEvent) => {
    if (!this.active || this.software || this.reduced.matches || event.pointerType !== 'mouse') return;
    this.pointer.set((event.clientX / innerWidth - .5) * .018, (event.clientY / innerHeight - .5) * .008);
    this.wake(600);
  };
  private handleVisibility = () => { if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; } else if (this.active) this.wake(); };
  private build() {
    const enamel = new THREE.MeshStandardMaterial({ color: 0x222925, metalness: .58, roughness: .31 });
    const darkEnamel = new THREE.MeshStandardMaterial({ color: 0x111813, metalness: .6, roughness: .36 });
    const black = new THREE.MeshStandardMaterial({ color: 0x151510, roughness: .86 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xb6b8ac, metalness: .95, roughness: .2 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xa79563, metalness: .85, roughness: .32 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x191b17, roughness: .98 });
    const ivory = new THREE.MeshStandardMaterial({ color: 0xe5ddbd, roughness: .48, metalness: .05 });
    const red = new THREE.MeshStandardMaterial({ color: 0x702d2b, roughness: .92 });
    const box = (w: number,h: number,d: number, material: THREE.Material,x=0,y=0,z=0,r=.06,parent:THREE.Object3D=this.machine) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,this.software?(Math.max(w,h,d)>2?6:1):3,r), material); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const cylinder = (radius:number, height:number, material:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=this.machine) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,this.software?16:32),material); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const bar = (a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material,parent:THREE.Object3D=this.machine) => {
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),10),material); mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()); mesh.castShadow=true; parent.add(mesh); return mesh;
    };
    // Rubber feet, cast metal base and the low keyboard apron.
    for (const x of [-2.8,2.8]) for (const z of [-1.55,1.7]) cylinder(.24,.16,rubber,x,.02,z);
    box(7.15,.4,4.7,enamel,0,.26,.16,.16);
    box(6.85,.16,4.35,darkEnamel,0,.51,.1,.08);
    box(6.5,.18,2.9,black,0,.61,.7,.06);
    // The sculpted shoulders frame the keyboard instead of concealing it.
    for (const x of [-3.23,3.23]) {
      const cheek=box(.42,.7,3.65,enamel,x,.76,.35,.16); cheek.rotation.x=-.1;
      box(.38,1.1,1.5,enamel,x,1.01,-1.25,.12);
      box(.05,.045,3.35,chrome,x + Math.sign(x)*.18,.5,.4,.02);
    }
    box(6.75,.65,1.68,enamel,0,1.1,-1.2,.2);
    const hood=box(5.9,.17,1.36,enamel,0,1.47,-1.08,.08); hood.rotation.x=.1;
    // The brushed maker's plate is a proper mesh with a locally drawn label.
    box(1.25,.035,.48,brass,0,1.585,-.55,.03);
    if(this.software) {
      const label=this.svgLabel('type.',true);label.position.set(0,1.62,-.55);this.machine.add(label);
    } else {
      const logoTexture=this.labelTexture('type.', '#28291e', 'italic 72px Georgia', 256,96);
      const logo=new THREE.Mesh(new THREE.PlaneGeometry(1.0,.37),new THREE.MeshBasicMaterial({map:logoTexture,transparent:true})); logo.rotation.x=-Math.PI/2; logo.position.set(0,1.607,-.55); this.machine.add(logo);
    }
    // Exposed type bars fan into the central printing point.
    for(let i=0;i<27;i++) {
      const angle=(i/26-.5)*2.15, x=Math.sin(angle)*1.55, z=-.68+Math.cos(angle)*.18;
      bar(new THREE.Vector3(x,1.33,z),new THREE.Vector3(x*.12,1.56,-1.12),.019,darkEnamel);
      box(.065,.085,.15,darkEnamel,x,1.35,z,.01);
    }
    // Four staggered rows of circular, metal-rimmed, individually animated keys.
    const rows=['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    rows.forEach((letters,row)=> {
      const spacing=.52, count=letters.length, z=.05+row*.56, y=1.115-row*.135;
      [...letters].forEach((letter,col)=> {
        const x=(col-(count-1)/2)*spacing + (row===1?-.13:row===2?.03:.09);
        const group=new THREE.Group(); group.position.set(x,y,z); this.machine.add(group);
        cylinder(.047,.29,chrome,0,-.02,0,group);
        if(!this.software) { cylinder(.226,.09,chrome,0,.125,0,group); cylinder(.199,.036,ivory,0,.183,0,group); }
        if(this.software) {
          const label=this.svgLabel(letter);label.position.y=.23;group.add(label);this.softwareKeys.set(letter.toLowerCase(),label.node.firstElementChild as SVGGElement);
        } else {
          const texture=this.labelTexture(letter,'#3a392d','500 76px Georgia',128,128);
          const face=new THREE.Mesh(new THREE.CircleGeometry(.179,32),new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:.8,depthWrite:false})); face.rotation.x=-Math.PI/2; face.position.y=.203; group.add(face);
        }
        this.keys.set(letter.toLowerCase(),{group,rest:y,pressedAt:-1000});
        if(!this.software)bar(new THREE.Vector3(x,y-.08,z),new THREE.Vector3(x*.8,.65,-.45),.024,darkEnamel);
      });
    });
    // Shift, backspace and a long polished spacebar.
    for(const [name,x,y,z,w] of [['shift',-2.84,.78,.55,.52],['backspace',2.87,1.12,-.02,.53]] as const) {
      const group=new THREE.Group(); group.position.set(x,y,z); this.machine.add(group);
      box(w,.17,.43,chrome,0,.06,0,.07,group); box(w-.06,.045,.37,ivory,0,.165,0,.06,group);
      this.keys.set(name,{group,rest:y,pressedAt:-1000});
    }
    const space=new THREE.Group(); space.position.set(0,.69,2.16); this.machine.add(space);
    box(3.7,.12,.29,chrome,0,0,0,.06,space);box(3.55,.08,.23,black,0,.075,0,.045,space);
    this.keys.set(' ',{group:space,rest:.69,pressedAt:-1000});
    // Ribbon spools sit either side of the basket; the ribbon has two physical bands.
    for(const x of [-2.16,2.16]) {
      cylinder(.59,.09,darkEnamel,x,1.6,-1.12);
      const reel=cylinder(.51,.065,black,x,1.66,-1.12); this.reels.push(reel);
      cylinder(.36,.035,darkEnamel,x,1.71,-1.12); cylinder(.055,.11,brass,x,1.77,-1.12);
      for(let i=0;i<5;i++) { const a=i*Math.PI*2/5; cylinder(.067,.012,black,x+Math.cos(a)*.22,1.735,-1.12+Math.sin(a)*.22); }
    }
    box(3.9,.065,.035,black,0,1.77,-.97,.008);
    box(3.9,.055,.035,red,0,1.71,-.97,.008);
    // The carriage has its own moving assembly.
    this.machine.add(this.carriage);
    box(7.8,.11,.18,chrome,0,1.65,-1.99,.035,this.carriage);
    box(7.3,.14,.3,darkEnamel,0,1.78,-1.8,.025,this.carriage);
    const roller=cylinder(.245,6.45,rubber,0,1.96,-1.72,this.carriage); roller.rotation.z=Math.PI/2;
    const axle=cylinder(.065,7.95,chrome,0,1.96,-1.72,this.carriage); axle.rotation.z=Math.PI/2;
    for(const x of [-3.78,3.78]) {
      const knob=cylinder(.27,.32,black,x,1.96,-1.72,this.carriage); knob.rotation.z=Math.PI/2;
      const ring=cylinder(.28,.055,chrome,x-Math.sign(x)*.19,1.96,-1.72,this.carriage);ring.rotation.z=Math.PI/2;
      for(let i=0;i<24;i++){const a=i*Math.PI/12;box(.33,.021,.03,darkEnamel,x,1.96+Math.sin(a)*.274,-1.72+Math.cos(a)*.274,.003,this.carriage);}
    }
    // Paper bail, scale, tiny red margin stop and return lever.
    box(6.5,.055,.09,chrome,0,2.17,-1.52,.02,this.carriage);
    for(const x of [-2.3,2.3]) {
      const bail=cylinder(.09,.17,rubber,x,2.15,-1.49,this.carriage); bail.rotation.z=Math.PI/2;
      box(.055,.35,.065,chrome,x,2,-1.47,.012,this.carriage);
    }
    box(5.6,.16,.025,brass,0,1.9,-1.4,.01,this.carriage);
    for(let i=0;i<57;i++)box(.012,i%5===0?.1:.055,.01,darkEnamel,(i-28)*.09,1.91,-1.382,.002,this.carriage);
    box(.1,.22,.07,red,2.55,1.94,-1.35,.02,this.carriage);
    this.carriage.add(this.lever); this.lever.position.set(-3.6,1.83,-1.66);
    bar(new THREE.Vector3(0,0,0),new THREE.Vector3(-.58,.58,.5),.047,chrome,this.lever);
    bar(new THREE.Vector3(-.58,.58,.5),new THREE.Vector3(.1,.58,.5),.055,chrome,this.lever);
    box(.48,.1,.22,black,-.04,.58,.5,.045,this.lever);
    // The central type hammer pivots up to the ribbon at every keystroke.
    this.hammer.position.set(0,1.03,-.2); this.machine.add(this.hammer);
    bar(new THREE.Vector3(0,0,0),new THREE.Vector3(0,.03,-.75),.035,chrome,this.hammer);
    box(.16,.085,.12,chrome,0,.03,-.76,.015,this.hammer);
    // Small screws, the red ribbon selector and vents complete the object.
    for(const x of [-3.24,3.24])for(const z of [-.7,1.65]) {
      cylinder(.046,.015,chrome,x,1.13-(z+.7)*.14,z);
    }
    for(let i=0;i<7;i++)box(.06,.018,.35,black,2.9+i*.055,1.48,-1.09,.015);
    cylinder(.065,.11,red,2.95,1.48,-.3);
    box(1.1,.13,.01,brass,0,.32,2.52,.02);
  }
  private svgLabel(text:string,logo=false) {
    const group=document.createElementNS('http://www.w3.org/2000/svg','g');
    const inner=document.createElementNS('http://www.w3.org/2000/svg','g');
    if(!logo) {
      const ring=document.createElementNS('http://www.w3.org/2000/svg','ellipse');ring.setAttribute('class','model-key-ring');
      const face=document.createElementNS('http://www.w3.org/2000/svg','ellipse');face.setAttribute('class','model-key-face');
      inner.append(ring,face);
    }
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('text-anchor','middle');label.setAttribute('dominant-baseline','central');
    label.setAttribute('fill',logo?'#292d23':'#3a392d');label.setAttribute('class',logo?'model-logo':'model-letter');label.textContent=text;inner.append(label);group.append(inner);
    return new SVGObject(group);
  }
  private labelTexture(text:string,color:string,font:string,width:number,height:number) {
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height/2+3);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace; return texture;
  }
  private resize() {
    const rect=this.container.getBoundingClientRect();if(!rect.width||!rect.height)return;
    this.width=rect.width;this.height=rect.height;
    const aspect=this.width/this.height;
    const viewWidth=9.8,viewHeight=viewWidth/aspect;
    this.camera.left=-viewWidth/2;this.camera.right=viewWidth/2;this.camera.top=viewHeight/2;this.camera.bottom=-viewHeight/2;
    this.camera.near=.1;this.camera.far=60;this.camera.updateProjectionMatrix();
    if(this.renderer instanceof THREE.WebGLRenderer)this.renderer.setSize(this.width,this.height,false);
    else this.renderer.setSize(this.width,this.height);
    this.container.style.setProperty('--model-label-size',`${this.width/9.8*.15}px`);
    this.container.style.setProperty('--model-key-rx',`${this.width/9.8*.22}px`);
    this.container.style.setProperty('--model-key-ry',`${this.width/9.8*.127}px`);
    this.needsRender=true;
    const paper=document.getElementById('page')!;
    const feed=new THREE.Vector3(0,2.18,-1.72).project(this.camera);
    const feedY=rect.top+(1-feed.y)*this.height/2;
    const roomTop=this.container.parentElement!.getBoundingClientRect().top;
    this.container.parentElement!.style.setProperty('--paper-height',`${Math.max(160,feedY-roomTop-paper.offsetTop+5)}px`);
    this.wake();
  }
  setActive(active:boolean) {
    this.active=active;
    if(active) { this.resize();this.wake(1000); }
    else { cancelAnimationFrame(this.frame);this.frame=0; }
  }
  strike(key:string,column:number,returnKey=false) {
    if(!this.active)return;
    if(this.software) {
      if(!this.reduced.matches) {
        const node=this.softwareKeys.get(key.toLowerCase())||this.softwareKeys.get('j');
        node?.animate([{transform:'translateY(0)'},{transform:'translateY(5px)',offset:.3},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
        if(returnKey)this.renderer.domElement.animate([{translate:'0 0'},{translate:'-5px 0',offset:.15},{translate:'0 0'}],{duration:350});
      }
      return;
    }
    const now=performance.now();
    const moving=this.keys.get(key.toLowerCase()) || this.keys.get('j')!;moving.pressedAt=now;
    this.strikeAt=now;
    this.carriageTarget=-(column%62)/62*.62;
    if(returnKey) {this.returnAt=now;this.carriageTarget=0;}
    this.wake(850);
  }
  private wake(duration=300) {
    this.renderUntil=Math.max(this.renderUntil,performance.now()+duration);
    if(this.active&&!this.frame&&!document.hidden&&!this.disposed)this.frame=requestAnimationFrame(this.tick);
  }
  private tick = (now:number) => {
    this.frame=0;if(!this.active||this.disposed)return;
    if(!this.reduced.matches&&!this.software) {
      for(const key of this.keys.values()) {
        const t=(now-key.pressedAt)/160;
        key.group.position.y=key.rest-(t>=0&&t<1?Math.sin(t*Math.PI)*.15:0);
      }
      const stroke=(now-this.strikeAt)/140;
      this.hammer.rotation.x=stroke>=0&&stroke<1?-Math.sin(stroke*Math.PI)*1.1:0;
      const returning=(now-this.returnAt)/450;
      this.lever.rotation.y=returning>=0&&returning<1?Math.sin(returning*Math.PI)*.24:0;
      this.carriagePosition=THREE.MathUtils.lerp(this.carriagePosition,this.carriageTarget,.15);
      this.carriage.position.x=this.carriagePosition;
      if(stroke>=0&&stroke<1)this.reels.forEach(reel=>reel.rotation.y+=.018);
      this.machine.rotation.y=THREE.MathUtils.lerp(this.machine.rotation.y,this.pointer.x,.08);
      this.machine.rotation.x=THREE.MathUtils.lerp(this.machine.rotation.x,this.pointer.y,.08);
    }
    if(this.needsRender||!this.software)this.renderer.render(this.scene,this.camera);
    this.needsRender=false;
    if(this.software)this.renderer.domElement.style.backgroundColor='transparent';
    if(now<this.renderUntil&&!this.reduced.matches&&!this.software)this.frame=requestAnimationFrame(this.tick);
  };
  dispose() {
    this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();window.removeEventListener('pointermove',this.handlePointer);document.removeEventListener('visibilitychange',this.handleVisibility);
    this.renderer.domElement.removeEventListener('webglcontextlost',this.handleLost);
    this.scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){if(material.map)material.map.dispose();material.dispose();}}});
    this.environment?.dispose();this.envGenerator?.dispose();if(this.renderer instanceof THREE.WebGLRenderer)this.renderer.dispose();this.renderer.domElement.remove();
  }
}
