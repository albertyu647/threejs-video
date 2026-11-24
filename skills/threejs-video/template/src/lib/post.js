// Selective bloom: glow only the objects you choose, then add the glow on top of the normal render.
// Blooming the whole frame also blooms captions and white UI, which looks cheap.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Usage:
 *   const bloom = makeBloom(renderer, W, H, { strength: 1.2, radius: 0.5, threshold: 0 });
 *   // each frame, after rendering the scene normally (autoClear off):
 *   bloom.render(glowScene, camera);   // glowScene holds only the objects that should glow (clones or shared meshes)
 * Occlusion: glowScene is rendered on its own, so glow would draw over solid objects in front of it. Add a black
 * occluder for each solid object that can sit in front of a glowing one: bloom.occluder(mesh) puts a black copy
 * (same geometry, same transform each frame via bloom.syncOccluders()) into glowScene.
 */
export function makeBloom(renderer, W, H, { strength = 1.0, radius = 0.4, threshold = 0.0 } = {}) {
  const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.renderToScreen = false;
  const rp = new RenderPass(new THREE.Scene(), new THREE.Camera()); rp.clearColor = new THREE.Color(0x000000); rp.clearAlpha = 1;
  const bp = new UnrealBloomPass(new THREE.Vector2(W, H), strength, radius, threshold);
  composer.addPass(rp); composer.addPass(bp);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tGlow: { value: null }, amount: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D tGlow; uniform float amount; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tGlow, vUv).rgb * amount, 1.); }',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  }));
  const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.Camera();
  const BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const occ = [];
  return {
    pass: bp,
    occluder(mesh, glowScene) { const o = new THREE.Mesh(mesh.geometry, BLACK); o.matrixAutoUpdate = false; glowScene.add(o); occ.push([o, mesh]); return o; },
    syncOccluders() { for (const [o, m] of occ) { m.updateWorldMatrix(true, false); o.matrix.copy(m.matrixWorld); o.visible = m.visible; } },
    set amount(v) { quad.material.uniforms.amount.value = v; },
    render(scene, camera) {
      this.syncOccluders(); rp.scene = scene; rp.camera = camera;
      const prevTarget = renderer.getRenderTarget();
      composer.render();
      quad.material.uniforms.tGlow.value = composer.readBuffer.texture;
      renderer.setRenderTarget(prevTarget);
      renderer.render(qScene, qCam);
    },
  };
}
