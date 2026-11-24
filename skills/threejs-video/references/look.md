# Designing the look

Decide these before building scenes, and write them in the plan. A deliberate look is what separates "3D demo"
from "made by a designer".

1. **One idea for the world.** Pick a material, place or object that belongs to the subject: paper for legal,
   brushed metal for hardware, a lit model for architecture, ink for finance. Avoid the generic dark-navy and
   cyan-glow "tech" scene unless the brand asks for it.
2. **Palette.** Pick one background value, one main colour and one accent used only for the thing that matters
   right now. Keep the accent rare, so when it appears it points somewhere. Check text contrast on stills.
3. **Light.** Use a key light plus a soft fill (HemisphereLight) for clarity. Add a rim or back light to separate
   objects from the background. `RoomEnvironment` + `PMREMGenerator` gives believable reflections on metal and
   glass with no HDR file:
   ```js
   import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
   scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
   ```
4. **Ground.** Objects floating in a void look like clip art. Add a floor with a soft contact shadow (a radial
   gradient texture under each object is cheap and deterministic), fog for depth, or a backdrop curve.
5. **Material.** `MeshStandardMaterial` / `MeshPhysicalMaterial` with real roughness values (0.3–0.7) read better
   than flat colours. `flatShading` gives a faceted, graphic look. Use `MeshBasicMaterial` for things that should
   glow, and add them to the glow scene.
6. **Camera.** Use a longer lens (fov 25–35) for product and hero shots and a wider one for spaces. Give every beat
   a move: push in, slow orbit, or a parallax drift. Add a small `shake` (0.01–0.02) for a handheld feel.
7. **Post.** Use selective bloom on emissive accents only. Add a light vignette or grain in a final full-screen
   pass if the piece wants texture. Keep it deterministic: noise seeded by frame number, not by time of day.
8. **Motion.** Use ease-out for things arriving, ease-in for leaving, and `outBack` / `spring` for playful pops.
   Stagger groups by 40–80 ms. Nothing should move linearly unless it's mechanical.

## Assets

- **GLTF/GLB models:** `GLTFLoader().loadAsync(url)` in startup code. For a model's built-in animations, drive
  `AnimationMixer` deterministically: `mixer.setTime(t)` inside `seek`, never `mixer.update(dt)`.
- **Images and textures:** `loadTexture()` in startup code.
- **Icons:** draw SVG icon sets (Remix Icon, Lucide) to a canvas via `Image` and use them as textures. Don't
  invent logos for real brands; write the brand name as text unless you were given the logo.
