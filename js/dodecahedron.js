// Raw WebGL renderer for a single rhombic dodecahedron (12 solid-colored
// rhombic faces, flat, no lighting).
import { mat4, quat } from "./math.js";

const VERTEX_SRC = `
  attribute vec3 aPosition;
  attribute vec3 aColor;
  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

const FRAGMENT_SRC = `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

// Twelve distinct, somewhat muted face colors (one per pentagonal face).
const FACE_COLORS = [
  [0.71, 0.34, 0.31],
  [0.78, 0.52, 0.33],
  [0.76, 0.64, 0.30],
  [0.54, 0.60, 0.36],
  [0.36, 0.55, 0.45],
  [0.31, 0.54, 0.55],
  [0.36, 0.50, 0.65],
  [0.35, 0.42, 0.64],
  [0.45, 0.39, 0.62],
  [0.55, 0.36, 0.60],
  [0.63, 0.36, 0.52],
  [0.64, 0.36, 0.42],
];

// Overall scale. The raw rhombic dodecahedron vertices below have a circumradius
// of 2 (the (±2,0,0)-style octahedron corners). Scaling down keeps the on-screen
// silhouette about the same size as the old shape was.
const SCALE = 0.7;

// Rhombic dodecahedron geometry: 14 vertices (8 cube corners + 6 octahedron
// vertices) forming 12 rhombic faces.
const VERTICES = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], // 0..3 cube corners
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1], // 4..7 cube corners
  [2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2], // 8..13 octahedron
];

// 12 rhombic faces, each given as 4 vertex indices (oct, cube, oct, cube)
// wound counter-clockwise when viewed from outside.
const FACES = [
  [8, 0, 10, 1],
  [8, 2, 12, 0],
  [8, 3, 11, 2],
  [8, 1, 13, 3],
  [9, 5, 10, 4],
  [9, 6, 12, 4],
  [9, 7, 11, 6],
  [9, 5, 13, 7],
  [10, 0, 12, 4],
  [10, 5, 13, 1],
  [11, 2, 12, 6],
  [11, 7, 13, 3],
];

function buildGeometry() {
  const positions = [];
  const colors = [];
  FACES.forEach((face, i) => {
    const c = FACE_COLORS[i % FACE_COLORS.length];
    const pts = face.map((vi) => VERTICES[vi].map((v) => v * SCALE));
    // Triangulate the rhombus as a fan around its first vertex.
    for (let t = 1; t < pts.length - 1; t++) {
      [pts[0], pts[t], pts[t + 1]].forEach((p) => {
        positions.push(p[0], p[1], p[2]);
        colors.push(c[0], c[1], c[2]);
      });
    }
  });
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    vertexCount: positions.length / 3,
  };
}

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + log);
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(program));
  }
  return program;
}

export class DodecahedronRenderer {
  constructor(canvas) {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL is not supported in this browser.");

    this.canvas = canvas;
    this.gl = gl;
    this.program = createProgram(gl);

    const geo = buildGeometry();
    this.vertexCount = geo.vertexCount;

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);

    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geo.colors, gl.STATIC_DRAW);

    this.attribs = {
      position: gl.getAttribLocation(this.program, "aPosition"),
      color: gl.getAttribLocation(this.program, "aColor"),
    };
    this.uniforms = {
      model: gl.getUniformLocation(this.program, "uModel"),
      view: gl.getUniformLocation(this.program, "uView"),
      projection: gl.getUniformLocation(this.program, "uProjection"),
    };

    // Camera pulled back along +Z so the shape sits in view.
    this.view = mat4.translate(0, 0, -10.0);
    this.projection = mat4.identity();

    gl.clearColor(0.949, 0.957, 0.972, 1.0); // matches the light CSS background
    gl.enable(gl.DEPTH_TEST);
    // Faces are listed as quads without guaranteed CCW winding, so draw both
    // sides instead of relying on back-face culling.
    gl.disable(gl.CULL_FACE);

    this.resize();
  }

  // Resize the drawing buffer to the displayed size (handles HiDPI + responsiveness).
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Measure the actual on-screen box. Using getBoundingClientRect (the rendered
    // size) instead of clientWidth/clientHeight avoids any chance of the drawing
    // buffer size feeding back into the layout.
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const aspect = this.canvas.width / this.canvas.height || 1;
    this.projection = mat4.perspective(Math.PI / 4, aspect, 0.1, 100);
  }

  // Draw the shape using the given orientation quaternion.
  render(orientation) {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);

    const model = mat4.fromQuat(orientation);
    gl.uniformMatrix4fv(this.uniforms.model, false, model);
    gl.uniformMatrix4fv(this.uniforms.view, false, this.view);
    gl.uniformMatrix4fv(this.uniforms.projection, false, this.projection);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(this.attribs.color);
    gl.vertexAttribPointer(this.attribs.color, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }
}

