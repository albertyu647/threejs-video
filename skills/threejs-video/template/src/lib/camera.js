// Camera moves as pure functions of t. A static camera is the single biggest reason 3D video looks flat.
import * as THREE from 'three';
import { clamp, ease, noise1 } from './time.js';

/**
 * Keyframed camera path. keys: [{ t, pos:[x,y,z], look:[x,y,z], fov? }, ...] sorted by t.
 * Position moves along a smooth Catmull-Rom curve through all keys; look target and fov ease between neighbours.
 * apply(camera, t) sets everything. Add handheld drift with { shake: 0.02 }.
 */
export function cameraPath(keys, { shake = 0, shakeSpeed = 0.6, fn = ease.inOutCubic } = {}) {
  const curve = new THREE.CatmullRomCurve3(keys.map(k => new THREE.Vector3(...k.pos)), false, 'centripetal');
  const v = new THREE.Vector3(), look = new THREE.Vector3();
  return {
    apply(cam, t) {
      let i = keys.findIndex((k, j) => t < (keys[j + 1]?.t ?? Infinity));
      if (i < 0) i = keys.length - 1;
      const a = keys[i], b = keys[i + 1] ?? a;
      const local = b === a ? 0 : fn(clamp((t - a.t) / (b.t - a.t)));
      const u = keys.length > 1 ? (i + local) / (keys.length - 1) : 0;
      curve.getPoint(clamp(u), v);
      look.set(...a.look).lerp(new THREE.Vector3(...b.look), local);
      if (shake) { v.x += noise1(t * shakeSpeed, 1) * shake; v.y += noise1(t * shakeSpeed, 2) * shake; }
      cam.position.copy(v); cam.lookAt(look);
      if (a.fov) { cam.fov = a.fov + ((b.fov ?? a.fov) - a.fov) * local; cam.updateProjectionMatrix(); }
    },
  };
}

// Slow orbit around a target; good default for a hero object.
export function orbit(cam, t, { target = [0, 0, 0], radius = 6, height = 1.5, speed = 0.15, start = 0 } = {}) {
  const a = start + t * speed;
  cam.position.set(target[0] + Math.sin(a) * radius, target[1] + height, target[2] + Math.cos(a) * radius);
  cam.lookAt(...target);
}
