// App entry point: wires the WebGL renderer and the input/animation controller
// together and drives the render loop.
import { DodecahedronRenderer } from "./dodecahedron.js";
import { Controls } from "./controls.js";

const canvas = document.getElementById("dodecahedron-canvas");
const stage = document.getElementById("stage");

let renderer;
try {
  renderer = new DodecahedronRenderer(canvas);
} catch (err) {
  stage.innerHTML =
    '<p style="color:#b00;font:16px system-ui;padding:1rem;text-align:center">' +
    "Unable to start WebGL: " + err.message + "</p>";
  throw err;
}

const controls = new Controls(stage);

// Keep the drawing buffer in sync with the element size (responsive + HiDPI).
const onResize = () => renderer.resize();
window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", onResize);

function frame(now) {
  const orientation = controls.update(now);
  renderer.render(orientation);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

