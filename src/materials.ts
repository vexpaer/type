import * as THREE from 'three';

// Seeded surfaces: repeatable, local, and independent of remote texture services.
function random(seed = 7341) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
function canvas(size: number) {
  const element = document.createElement('canvas'); element.width = element.height = size;
  return { element, ctx: element.getContext('2d')! };
}
function texture(element: HTMLCanvasElement, color = true) {
  const map = new THREE.CanvasTexture(element);
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

export function enamelSurface() {
  const { element, ctx } = canvas(256), rng = random(19);
  const pixels = ctx.createImageData(256, 256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const n = 90 + rng() * 65;
    pixels.data.set([n, n, n, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const map = texture(element, false); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(3, 3);
  return map;
}

export function paperSurface() {
  const { element, ctx } = canvas(1024), rng = random(115);
  const pixels = ctx.createImageData(1024, 1024);
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    const n = (rng() - .5) * 20 + Math.sin(y * .48) * 1.4;
    const edge = Math.pow(Math.abs(x / 512 - 1), 12) * 5;
    const i = (y * 1024 + x) * 4;
    pixels.data.set([237 + n - edge, 226 + n - edge, 203 + n - edge, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  // Long, interlocked pulp fibres, laid lines and occasional darker inclusions.
  for (let i = 0; i < 18500; i++) {
    const x = rng() * 1024, y = rng() * 1024, length = 2 + rng() * 16;
    ctx.strokeStyle = rng() > .52 ? 'rgba(109,88,55,.12)' : 'rgba(255,252,240,.32)';
    ctx.lineWidth = .35 + rng() * .7; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + length * .4, y - 1, x + length, y + (rng() - .5) * 3); ctx.stroke();
  }
  for (let y = 0; y < 1024; y += 4) { ctx.fillStyle = 'rgba(131,111,77,.022)'; ctx.fillRect(0, y, 1024, .65); }
  const color = texture(element);
  const bump = texture(element, false);
  return { color, bump, url: element.toDataURL() };
}

export function deskSurface() {
  const { element, ctx } = canvas(1024), rng = random(762);
  ctx.fillStyle = '#30251e'; ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 3200; i++) {
    const y = rng() * 1024;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * .004 + y * .023) * 9 + Math.sin(x * .017 + y) * 1.3);
    }
    ctx.strokeStyle = i % 3 ? `rgba(132,93,61,${rng() * .11})` : `rgba(6,4,3,${rng() * .25})`;
    ctx.lineWidth = .3 + rng() * 1.6; ctx.stroke();
  }
  const map = texture(element); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(28, 28);
  return map;
}

export function labelTexture(text: string, sub = '', dark = false) {
  const { element, ctx } = canvas(128);
  ctx.fillStyle = dark ? '#e0d7bc' : '#e6d9b6';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = text.length > 2 ? '600 28px Georgia' : '600 76px Georgia';
  ctx.fillText(text, 64, sub ? 80 : 67);
  if (sub) { ctx.font = '23px Georgia'; ctx.globalAlpha = .78; ctx.fillText(sub, 64, 30); }
  // Small print variation, rather than damage painted over the whole keycap.
  const rng = random(text.charCodeAt(0) * 37); ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 75; i++) { ctx.globalAlpha = .12 + rng() * .22; ctx.fillRect(rng() * 128, rng() * 128, .45 + rng() * .7, .6 + rng() * 1.1); }
  return texture(element);
}
