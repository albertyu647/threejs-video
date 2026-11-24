# Recipe: logo sting, intro or outro

Usually 2–6 seconds: a brand mark or title resolves, often over other footage.

- **Use the real logo.** Load an SVG with `SVGLoader` (`three/addons/loaders/SVGLoader.js`). `SVGLoader.createShapes`
  plus `ExtrudeGeometry` gives an extruded 3D mark. Never redraw or invent a brand's logo; if you don't have the
  file, use the name in type.
- **Structure:** anticipation (0.3–0.8 s), action (the mark forms: pieces assemble, a light sweep, a reveal
  through a mask), settle (overshoot via `spring`), then hold (at least 1 s with the mark still and readable).
- **Light sweep:** move a narrow, bright `RectAreaLight` or a moving specular highlight across a metallic
  material (`roughness` 0.2–0.35 with an environment map, see look.md).
- **Transparent export** for use over other video: `node render.mjs video --alpha`. This gives ProRes 4444 with
  alpha in `final.mov`. Keep the renderer `alpha: true`, call `setClearColor(0x000000, 0)` and draw no background
  mesh. Check the alpha in `qa.py` stills or with
  `ffmpeg -i final.mov -vf alphaextract -frames:v 1 a.png`.
- **Seamless loop:** make every motion periodic in the duration, with `Math.sin(2π t / duration)` or a
  `cameraPath` whose last key equals its first. Then frame N equals frame 0.
- **Sound:** a sting usually wants a whoosh and a hit. If you add SFX, place them at the action and settle cues and
  mix them under any voice.
