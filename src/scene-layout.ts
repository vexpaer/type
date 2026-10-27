import * as THREE from 'three';

export const PAPER_WIDTH = 5.48;
export const PAPER_HEIGHT = 4.65;
export const PAPER_TILT = -.14;
// Tangency to the rubber platen, including the paper's backward lean.
export const PAPER_ANCHOR = new THREE.Vector3(0, 2.04 - Math.sin(PAPER_TILT) * .264, -1.82 + Math.cos(PAPER_TILT) * .264);
// The editable print line now extends to the tangency point of the platen.
export const PAPER_READING_BOTTOM = -.035;

/** Fit one physical assembly; the paper never stretches to fill a viewport. */
export function fitCamera(camera: THREE.PerspectiveCamera, width: number, height: number) {
  const mobile = width < 600;
  camera.fov = mobile ? 22 : 26; camera.aspect = width / height; camera.near = .1; camera.far = 180;
  const center = new THREE.Vector3(0, 2.95, -.42);
  const direction = new THREE.Vector3(.018, .48, 1).normalize();
  const corners: THREE.Vector3[] = [];
  for (const x of mobile ? [-2.5, 2.5] : [-4.64, 4.64]) for (const y of [0, 2.65]) for (const z of [-2.48, 2.74]) corners.push(new THREE.Vector3(x, y, z));
  const paperMargin = mobile ? .14 : .37;
  for (const x of [-PAPER_WIDTH / 2 - paperMargin, PAPER_WIDTH / 2 + paperMargin]) {
    corners.push(new THREE.Vector3(x, PAPER_HEIGHT * Math.cos(PAPER_TILT), PAPER_HEIGHT * Math.sin(PAPER_TILT)).add(PAPER_ANCHOR));
  }
  // Binary fitting includes perspective depth and room for carriage movement.
  let near = 8, far = 90;
  const place = (distance: number) => {
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.lookAt(center); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  };
  for (let i = 0; i < 26; i++) {
    const distance = (near + far) / 2; place(distance);
    const fits = corners.every(point => { const p = point.clone().project(camera); return Math.abs(p.x) < .94 && p.y < .89 && p.y > -.92; });
    if (fits) far = distance; else near = distance;
  }
  place(far);
}
