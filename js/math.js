// Minimal column-major 4x4 matrix + quaternion helpers for WebGL.
// All matrices are Float32Array(16) in column-major order (WebGL friendly).

export const mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  // Perspective projection. fovy in radians.
  perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },

  // out = a * b
  multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  },

  translate(x, y, z) {
    const m = mat4.identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  },

  // Build a rotation matrix from a unit quaternion {x, y, z, w}.
  fromQuat(q) {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([
      1 - (yy + zz), xy + wz, xz - wy, 0,
      xy - wz, 1 - (xx + zz), yz + wx, 0,
      xz + wy, yz - wx, 1 - (xx + yy), 0,
      0, 0, 0, 1,
    ]);
  },
};

export const quat = {
  identity() {
    return { x: 0, y: 0, z: 0, w: 1 };
  },

  // Rotation of `angle` radians about a (not necessarily unit) axis.
  fromAxisAngle(ax, ay, az, angle) {
    const len = Math.hypot(ax, ay, az) || 1;
    const half = angle / 2;
    const s = Math.sin(half) / len;
    return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(half) };
  },

  // out = a * b  (apply b first, then a)
  multiply(a, b) {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
  },

  normalize(q) {
    const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
  },

  // Spherical linear interpolation between two unit quaternions.
  slerp(a, b, t) {
    let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;

    // Take the shorter path.
    if (cos < 0) {
      cos = -cos;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }

    let scaleA, scaleB;
    if (1 - cos > 1e-6) {
      const omega = Math.acos(cos);
      const sin = Math.sin(omega);
      scaleA = Math.sin((1 - t) * omega) / sin;
      scaleB = Math.sin(t * omega) / sin;
    } else {
      // Nearly identical: fall back to linear.
      scaleA = 1 - t;
      scaleB = t;
    }

    return quat.normalize({
      x: a.x * scaleA + bx * scaleB,
      y: a.y * scaleA + by * scaleB,
      z: a.z * scaleA + bz * scaleB,
      w: a.w * scaleA + bw * scaleB,
    });
  },
};

