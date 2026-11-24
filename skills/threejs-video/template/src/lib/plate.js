// Footage plate for the pixel UI camera: an image sequence on a plane with offset, dim, blur, cool grade and a
// feathered top edge, plus an optional cut-out layer (RGBA sequence of the subject) that moves with it.
// Used by the video-overlay recipe; also handy for any piece that mixes footage with 3D.
import * as THREE from 'three';
import { imageSequence } from './media.js';

/**
 * makePlate({ W, H, frames: 'assets/clip/%04d.jpg', cutout: 'assets/cutout/%04d.png', fps: 30, count })
 * Returns { plate, cut, set(t, { shift, dim, blur, fade, scale }) }. Add plate.mesh behind your 3D pass and
 * cut.mesh after it, so the person stays in front of the graphics.
 *   shift: px the footage moves down. dim: 1 = normal, 0.35 = dark. blur: 0..1. fade: 0..1 feathers the top edge.
 */
export function makePlate({ W, H, frames, cutout = null, fps = 30, count = Infinity }) {
  const seq = imageSequence(frames, { fps, count });
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: seq.texture }, dim: { value: 1 }, blur: { value: 0 }, fade: { value: 0 }, texel: { value: new THREE.Vector2(1 / W, 1 / H) } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D map; uniform float dim, blur, fade; uniform vec2 texel; varying vec2 vUv;
      void main(){
        vec2 p = texel * blur * 7.;
        vec4 c = texture2D(map, vUv) * .2;
        c += (texture2D(map, vUv + vec2(p.x, 0.)) + texture2D(map, vUv - vec2(p.x, 0.)) + texture2D(map, vUv + vec2(0., p.y)) + texture2D(map, vUv - vec2(0., p.y))) * .12;
        c += (texture2D(map, vUv + p) + texture2D(map, vUv - p) + texture2D(map, vUv + vec2(p.x, -p.y)) + texture2D(map, vUv + vec2(-p.x, p.y))) * .08;
        vec3 col = c.rgb * dim;
        col = mix(col, col * vec3(.82, .92, 1.12), (1. - dim) * .8);   // cooler as it darkens, so foreground pops
        float a = mix(1., smoothstep(1.0, 0.86, vUv.y), fade);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  const plate = { mesh, seq };
  let cut = null;
  if (cutout) {
    const cseq = imageSequence(cutout, { fps, count });
    const cmesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: cseq.texture, transparent: true, depthWrite: false, toneMapped: false }));
    // soft drop shadow so the subject separates from the dimmed plate
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: cseq.texture, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    shadow.renderOrder = -1;
    const group = new THREE.Group(); group.add(shadow, cmesh);
    cut = { mesh: group, seq: cseq, shadow };
  }
  return {
    plate, cut,
    async set(t, { shift = 0, dim = 1, blur = 0, fade = 0, scale = 1 } = {}) {
      await Promise.all([seq.set(t), cut?.seq.set(t)]);
      mat.uniforms.dim.value = dim; mat.uniforms.blur.value = blur; mat.uniforms.fade.value = fade;
      mesh.position.set(0, -shift, 0); mesh.scale.setScalar(scale);
      if (cut) {
        cut.mesh.position.set(0, -shift, 0); cut.mesh.scale.setScalar(scale);
        const s = 1 - dim; cut.shadow.material.opacity = 0.5 * s; cut.shadow.position.set(6 * s, -10 * s, 0);
        cut.mesh.visible = s > 0.001;   // only needed while the plate is altered; the plate already shows the person
      }
    },
    get missing() { return seq.missing + (cut?.seq.missing ?? 0); },
  };
}
