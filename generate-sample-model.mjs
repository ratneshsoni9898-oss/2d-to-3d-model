// Generates a minimal valid .glb file with a torus knot mesh
// Uses raw binary construction (no browser APIs needed)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate torus knot vertices and indices
function generateTorusKnot(radius = 0.8, tube = 0.25, tubularSegments = 64, radialSegments = 16, p = 2, q = 3) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const u = (i / tubularSegments) * p * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const quOverP = (q / p) * u;
    const cq = Math.cos(quOverP);

    const cx = radius * (2 + cq) * 0.5 * cu;
    const cy = radius * (2 + cq) * 0.5 * su;
    const cz = radius * Math.sin(quOverP) * 0.5;

    // Tangent
    const du = 0.01;
    const u2 = u + du;
    const cu2 = Math.cos(u2);
    const su2 = Math.sin(u2);
    const cq2 = Math.cos((q / p) * u2);
    const tx = radius * (2 + cq2) * 0.5 * cu2 - cx;
    const ty = radius * (2 + cq2) * 0.5 * su2 - cy;
    const tz = radius * Math.sin((q / p) * u2) * 0.5 - cz;
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
    const T = [tx / tLen, ty / tLen, tz / tLen];

    // Normal-ish
    let N = [cu, su, 0];
    // Binormal
    const B = [
      T[1] * N[2] - T[2] * N[1],
      T[2] * N[0] - T[0] * N[2],
      T[0] * N[1] - T[1] * N[0],
    ];
    const bLen = Math.sqrt(B[0] * B[0] + B[1] * B[1] + B[2] * B[2]);
    if (bLen > 0) {
      B[0] /= bLen; B[1] /= bLen; B[2] /= bLen;
    }
    N = [
      B[1] * T[2] - B[2] * T[1],
      B[2] * T[0] - B[0] * T[2],
      B[0] * T[1] - B[1] * T[0],
    ];

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);

      const px = cx + tube * (cv * N[0] + sv * B[0]);
      const py = cy + tube * (cv * N[1] + sv * B[1]);
      const pz = cz + tube * (cv * N[2] + sv * B[2]);
      positions.push(px, py, pz);

      const nx = cv * N[0] + sv * B[0];
      const ny = cv * N[1] + sv * B[1];
      const nz = cv * N[2] + sv * B[2];
      normals.push(nx, ny, nz);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return { positions, normals, indices };
}

// Also generate a sphere
function generateSphere(radius = 0.2, widthSeg = 16, heightSeg = 12, offsetX = 1.2, offsetY = 0.5) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let y = 0; y <= heightSeg; y++) {
    for (let x = 0; x <= widthSeg; x++) {
      const u = x / widthSeg;
      const v = y / heightSeg;
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;

      const px = -radius * Math.cos(theta) * Math.sin(phi) + offsetX;
      const py = radius * Math.cos(phi) + offsetY;
      const pz = radius * Math.sin(theta) * Math.sin(phi);

      const nx = -Math.cos(theta) * Math.sin(phi);
      const ny = Math.cos(phi);
      const nz = Math.sin(theta) * Math.sin(phi);

      positions.push(px, py, pz);
      normals.push(nx, ny, nz);
    }
  }

  for (let y = 0; y < heightSeg; y++) {
    for (let x = 0; x < widthSeg; x++) {
      const a = y * (widthSeg + 1) + x;
      const b = a + widthSeg + 1;
      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return { positions, normals, indices };
}

// Merge geometries
function mergeGeometries(geos) {
  const allPos = [];
  const allNor = [];
  const allIdx = [];
  let vertexOffset = 0;

  for (const geo of geos) {
    allPos.push(...geo.positions);
    allNor.push(...geo.normals);
    for (const idx of geo.indices) {
      allIdx.push(idx + vertexOffset);
    }
    vertexOffset += geo.positions.length / 3;
  }

  return {
    positions: new Float32Array(allPos),
    normals: new Float32Array(allNor),
    indices: allIdx.every(i => i < 65536) ? new Uint16Array(allIdx) : new Uint32Array(allIdx),
  };
}

// Build GLB binary
function buildGLB(positions, normals, indices) {
  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxX = Math.max(maxX, positions[i]);
    maxY = Math.max(maxY, positions[i + 1]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }

  const posBuffer = Buffer.from(positions.buffer);
  const norBuffer = Buffer.from(normals.buffer);
  const idxBuffer = Buffer.from(indices.buffer);

  const indexComponentType = indices instanceof Uint16Array ? 5123 : 5125;
  const indexByteLength = idxBuffer.length;

  // Align to 4 bytes
  const pad = (n) => (4 - (n % 4)) % 4;

  const posOffset = 0;
  const norOffset = posBuffer.length + pad(posBuffer.length);
  const idxOffset = norOffset + norBuffer.length + pad(norBuffer.length);
  const totalBinLength = idxOffset + idxBuffer.length;
  const paddedBinLength = totalBinLength + pad(totalBinLength);

  const binData = Buffer.alloc(paddedBinLength);
  posBuffer.copy(binData, posOffset);
  norBuffer.copy(binData, norOffset);
  idxBuffer.copy(binData, idxOffset);

  const vertexCount = positions.length / 3;
  const indexCount = indices.length;

  const gltfJson = {
    asset: { version: '2.0', generator: 'AntiGravity3D' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'AntiGravityModel' }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
      }],
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [0.388, 0.4, 0.945, 1.0],
        metallicFactor: 0.7,
        roughnessFactor: 0.3,
      },
      name: 'IndigoPurple',
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
        max: [maxX, maxY, maxZ],
        min: [minX, minY, minZ],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: vertexCount,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: indexComponentType,
        count: indexCount,
        type: 'SCALAR',
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: posOffset,
        byteLength: posBuffer.length,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: norOffset,
        byteLength: norBuffer.length,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: idxOffset,
        byteLength: indexByteLength,
        target: 34963,
      },
    ],
    buffers: [{
      byteLength: paddedBinLength,
    }],
  };

  const jsonStr = JSON.stringify(gltfJson);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');
  const jsonPaddedLength = jsonBuffer.length + pad(jsonBuffer.length);
  const jsonPadded = Buffer.alloc(jsonPaddedLength, 0x20); // pad with spaces
  jsonBuffer.copy(jsonPadded);

  // GLB Header: magic(4) + version(4) + length(4) = 12 bytes
  // Chunk 0 (JSON): length(4) + type(4) + data
  // Chunk 1 (BIN): length(4) + type(4) + data
  const totalLength = 12 + 8 + jsonPaddedLength + 8 + paddedBinLength;

  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  // Header
  glb.writeUInt32LE(0x46546C67, offset); offset += 4; // magic 'glTF'
  glb.writeUInt32LE(2, offset); offset += 4; // version
  glb.writeUInt32LE(totalLength, offset); offset += 4; // total length

  // JSON chunk
  glb.writeUInt32LE(jsonPaddedLength, offset); offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); offset += 4; // 'JSON'
  jsonPadded.copy(glb, offset); offset += jsonPaddedLength;

  // BIN chunk
  glb.writeUInt32LE(paddedBinLength, offset); offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); offset += 4; // 'BIN\0'
  binData.copy(glb, offset);

  return glb;
}

// Run
const torusKnot = generateTorusKnot(0.8, 0.25, 64, 16, 2, 3);
const sphere1 = generateSphere(0.2, 16, 12, 1.3, 0.5);
const sphere2 = generateSphere(0.15, 16, 12, -1.1, -0.3);
const sphere3 = generateSphere(0.18, 16, 12, 0.5, -0.9);

const merged = mergeGeometries([torusKnot, sphere1, sphere2, sphere3]);
const glb = buildGLB(merged.positions, merged.normals, merged.indices);

const outPath = path.join(__dirname, 'public', 'models', 'sample.glb');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, glb);
console.log(`✅ Sample GLB saved to ${outPath} (${glb.length} bytes)`);
