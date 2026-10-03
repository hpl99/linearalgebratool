/**
 * LINEAR ALGEBRA LAB — MASTER SIMULATION & INTERACTIVE MATHEMATICS ENGINE
 * 
 * Core Components:
 * 1. Procedural 3-Track Ambient Synthesizer (Web Audio API)
 * 2. Two-Grid Transformation Engine & Smooth I -> M Space Warping
 * 3. 17 Foundation, Transformation & Computation Modules
 * 4. Command Palette (Ctrl+K), Focus Mode, & View Perspectives
 * 5. Interactive Challenge Mode & Automated Geometric Verifiers
 * 6. Lab Notebook (Local Observations) & Deep Link URL Serialization
 * 7. High-Resolution Branded Canvas Screenshot Generator
 */

// ==========================================================================
// 1. GLOBAL STATE & DESIGN TOKENS
// ==========================================================================
const state = {
  activeExpId: 1,
  appMode: 'explore', // 'explore' | 'guided' | 'challenge'
  viewMode: 'space',  // 'space' | 'both' | 'math'
  activeChallengeId: 1,

  // Two-Grid & Rendering Options
  gridMode: 'both',   // 'both' | 'orig' | 'trans'
  showOriginalGrid: true,
  showTransformedGrid: true,
  showPlanes: false,
  showDropLines: true,
  showTrace: false,
  inspectMode: false,
  focusMode: false,
  
  // Transformation Flow Scrub Timeline (0.0 = Identity I, 1.0 = Target Matrix M)
  flowProgress: 1.0,
  flowPlaying: false,

  // Settings & Preferences
  reducedMotion: false,
  showStarfield: true,
  enableSfx: true,

  // Primary Vector (Exp 1, 2, 5, 8, 9, 11)
  v: { x: 3.0, y: 2.0, z: 1.0 },

  // Secondary Vectors (Exp 3, 4, 6, 7)
  a: { x: 3.0, y: 1.0, z: 0.0 },
  b: { x: 1.0, y: 2.0, z: 0.0 },

  // Scalar Multiplier (Exp 5)
  scalar: 2.0,

  // 2x2 Transformation Matrix (Exp 9, 10, 11, 13, 14, 15)
  M: { a: 1.0, b: 0.0, c: 0.0, d: 1.0 },

  // Matrix Multiplication (Exp 12)
  matRotDeg: 45,
  matShearK: 1.0,
  multOrder: 'AB', // 'AB' or 'BA'

  // Matrix Inverse Step (Exp 14: 0 = Original, 1 = Warped, 2 = Restored)
  invStep: 0,

  // Vector Cloud Batching (Exp 15)
  cloudCount: 64,
  cloudAngle: 30,

  // SIMD Hardware Lanes (Exp 16, 17)
  simdMode: 128, // 128 or 256 bit
  simdExecuted: false,
  simdScalar: 2.0
};

const COLORS = {
  axisX: 0xef4444,
  axisY: 0x10b981,
  axisZ: 0x3b82f6,
  vectorV: 0x38bdf8,
  vectorA: 0x38bdf8,
  vectorB: 0xf43f5e,
  vectorRes: 0x10b981,
  vectorProj: 0xfbbf24,
  gridOriginal: 0x182231,
  gridTransformed: 0x6366f1,
  dropLine: 0x475569,
  basisI: 0xef4444,
  basisJ: 0x10b981,
  basisK: 0x3b82f6
};

// Three.js Globals
let scene, camera, renderer, controls;
let dynamicObjectsGroup, baseGridGroup, transformedGridGroup, starFieldGroup;
let traceLineMesh = null;
let tracePoints = [];
let draggableMeshes = [];
let activeDragTarget = null;
let dragPlane = new THREE.Plane();
let planeIntersect = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isDragging = false;
let cameraTween = null;

// ==========================================================================
// 2. PROCEDURAL 3-TRACK SPACE AMBIENT SYNTHESIZER
// ==========================================================================
class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.currentTrack = 'deep-space';
    this.volume = 0.3;
    this.masterGain = null;
    this.trackGain = null;
    this.activeNodes = [];
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.trackGain = this.ctx.createGain();
    this.trackGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.trackGain.connect(this.masterGain);
  }

  start() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.stopCurrentTrack();
    this.buildTrack(this.currentTrack);
    this.isPlaying = true;
    this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.5);
    return true;
  }

  stop() {
    if (!this.isPlaying || !this.masterGain) return false;
    this.isPlaying = false;
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    setTimeout(() => {
      if (!this.isPlaying) this.stopCurrentTrack();
    }, 500);
    return false;
  }

  toggle() {
    if (this.isPlaying) return this.stop();
    return this.start();
  }

  setVolume(val) {
    this.volume = parseFloat(val);
    if (this.isPlaying && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  switchTrack(trackName) {
    if (this.currentTrack === trackName) return;
    this.currentTrack = trackName;
    if (!this.isPlaying) return;

    const now = this.ctx.currentTime;
    this.trackGain.gain.setTargetAtTime(0.001, now, 0.3);
    setTimeout(() => {
      this.stopCurrentTrack();
      this.buildTrack(trackName);
      this.trackGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.5);
    }, 350);
  }

  stopCurrentTrack() {
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  buildTrack(name) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (name === 'deep-space') {
      // 55Hz sub drone + slow resonant lowpass breathing
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);
      filter.Q.setValueAtTime(3.5, now);
      filter.connect(this.trackGain);
      this.activeNodes.push(filter);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.05, now);
      lfoGain.gain.setValueAtTime(60, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.activeNodes.push(lfo, lfoGain);

      [55, 110, 164.81].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.25 / (idx + 1), now);
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        this.activeNodes.push(osc, gain);
      });
    } else if (name === 'orbital') {
      // Pulsing harmonic triad chords
      const chords = [130.81, 164.81, 196.00];
      chords.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const tremolo = this.ctx.createOscillator();
        const tremGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        tremolo.frequency.setValueAtTime(0.18 + i * 0.04, now);
        tremGain.gain.setValueAtTime(0.08, now);
        tremolo.connect(tremGain);
        tremGain.connect(gain.gain);

        gain.gain.setValueAtTime(0.15, now);
        osc.connect(gain);
        gain.connect(this.trackGain);

        osc.start();
        tremolo.start();
        this.activeNodes.push(osc, gain, tremolo, tremGain);
      });
    } else if (name === 'cosmic-drift') {
      // Ethereal crystalline shimmer
      [220, 277.18, 329.63, 440].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.06 / (idx + 1), now);

        if (panner) {
          panner.pan.setValueAtTime((idx % 2 === 0 ? 0.4 : -0.4), now);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(this.trackGain);
          this.activeNodes.push(panner);
        } else {
          osc.connect(gain);
          gain.connect(this.trackGain);
        }
        osc.start();
        this.activeNodes.push(osc, gain);
      });
    }
  }

  triggerChime(freq = 440) {
    if (!state.enableSfx || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.36);
    } catch (e) {}
  }
}

const audio = new SpaceAudioEngine();

// ==========================================================================
// 3. THREE.JS INITIALIZATION & SCENE GRAPH
// ==========================================================================
function initScene() {
  const container = document.getElementById('viewport');
  const canvas = document.getElementById('canvas3d');

  // Check WebGL availability
  if (!window.WebGLRenderingContext) {
    document.getElementById('webglFallback').style.display = 'flex';
    return false;
  }

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03060b, 0.022);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(7.5, 6.5, 9.5);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxDistance = 35;
  controls.minDistance = 2;
  controls.target.set(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(10, 15, 10);
  scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x6366f1, 0.4);
  backLight.position.set(-10, -10, -10);
  scene.add(backLight);

  // Scene Hierarchy Groups
  dynamicObjectsGroup = new THREE.Group();
  scene.add(dynamicObjectsGroup);

  buildStarfield();
  buildCoordinateGrids();
  initTraceMesh();
  setupInteractionEvents();

  window.addEventListener('resize', onWindowResize);
  return true;
}

function buildStarfield() {
  starFieldGroup = new THREE.Group();
  const starCount = 350;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const r = 25 + Math.random() * 25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const shade = 0.4 + Math.random() * 0.45;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 1.05;
    colors[i * 3 + 2] = shade * 1.2;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.65
  });

  const stars = new THREE.Points(geom, mat);
  starFieldGroup.add(stars);
  scene.add(starFieldGroup);
}

function buildCoordinateGrids() {
  baseGridGroup = new THREE.Group();

  // Original Coordinate Floor Grid on XY plane
  const gridHelper = new THREE.GridHelper(16, 16, 0x223247, 0x0e1726);
  gridHelper.rotation.x = Math.PI / 2;
  baseGridGroup.add(gridHelper);

  // Coordinate Axes
  const axisLen = 7.5;
  const origin = new THREE.Vector3(0, 0, 0);

  const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, axisLen, COLORS.axisX, 0.22, 0.07);
  const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, axisLen, COLORS.axisY, 0.22, 0.07);
  const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, axisLen, COLORS.axisZ, 0.22, 0.07);
  baseGridGroup.add(arrowX, arrowY, arrowZ);

  // 3D Axis Labels
  create3DLabel('X', new THREE.Vector3(axisLen + 0.3, 0, 0), '#ef4444', baseGridGroup);
  create3DLabel('Y', new THREE.Vector3(0, axisLen + 0.3, 0), '#10b981', baseGridGroup);
  create3DLabel('Z', new THREE.Vector3(0, 0, axisLen + 0.3), '#3b82f6', baseGridGroup);

  scene.add(baseGridGroup);

  transformedGridGroup = new THREE.Group();
  scene.add(transformedGridGroup);
}

function create3DLabel(text, pos, colorHexStr, parentGroup = dynamicObjectsGroup) {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  const fontSize = 36;
  tempCtx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
  const textMetrics = tempCtx.measureText(text);
  const textWidth = Math.ceil(textMetrics.width);
  const padX = 22;
  const cWidth = Math.max(80, textWidth + padX * 2);
  const cHeight = 60;

  const canvas = document.createElement('canvas');
  canvas.width = cWidth;
  canvas.height = cHeight;
  const ctx = canvas.getContext('2d');
  ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle dark pill background for readability
  if (text.length > 2) {
    ctx.fillStyle = 'rgba(7, 12, 20, 0.75)';
    ctx.beginPath();
    ctx.roundRect(4, 4, cWidth - 8, cHeight - 8, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.fillStyle = colorHexStr;
  ctx.fillText(text, cWidth / 2, cHeight / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, opacity: 0.92 });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.copy(pos);
  const aspect = cWidth / cHeight;
  const hScale = 0.36;
  sprite.scale.set(hScale * aspect, hScale, 1);
  parentGroup.add(sprite);
  return sprite;
}

function initTraceMesh() {
  const maxPts = 200;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(maxPts * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: COLORS.vectorV,
    transparent: true,
    opacity: 0.6,
    linewidth: 1
  });
  traceLineMesh = new THREE.Line(geom, mat);
  traceLineMesh.frustumCulled = false;
  scene.add(traceLineMesh);
}

function addTracePoint(pos) {
  if (!state.showTrace) return;
  tracePoints.push(pos.clone());
  if (tracePoints.length > 200) tracePoints.shift();

  const posAttr = traceLineMesh.geometry.attributes.position;
  for (let i = 0; i < tracePoints.length; i++) {
    posAttr.setXYZ(i, tracePoints[i].x, tracePoints[i].y, tracePoints[i].z);
  }
  traceLineMesh.geometry.setDrawRange(0, tracePoints.length);
  posAttr.needsUpdate = true;
}

function clearTrace() {
  tracePoints = [];
  if (traceLineMesh) traceLineMesh.geometry.setDrawRange(0, 0);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================================================
// 4. MATHEMATICAL GRAPHICS PRIMITIVES
// ==========================================================================
function createThickArrow(start, end, colorHex, radius = 0.034, headLen = 0.25, headRad = 0.08, userData = null) {
  const group = new THREE.Group();
  if (userData) group.userData = userData;

  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();

  if (len < 0.001) return group;

  const shaftLen = Math.max(0.001, len - headLen);
  const shaftGeom = new THREE.CylinderGeometry(radius, radius, shaftLen, 16);
  shaftGeom.translate(0, shaftLen / 2, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.5,
    emissive: colorHex,
    emissiveIntensity: 0.45
  });

  const shaft = new THREE.Mesh(shaftGeom, mat);

  const headGeom = new THREE.ConeGeometry(headRad, headLen, 16);
  headGeom.translate(0, shaftLen + headLen / 2, 0);
  const head = new THREE.Mesh(headGeom, mat);

  group.add(shaft);
  group.add(head);

  group.position.copy(start);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

  dynamicObjectsGroup.add(group);
  return group;
}

function createDraggableEndpoint(pos, colorHex, idTag) {
  const geom = new THREE.SphereGeometry(0.09, 24, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.15,
    metalness: 0.7,
    emissive: colorHex,
    emissiveIntensity: 0.8
  });
  const sphere = new THREE.Mesh(geom, mat);
  sphere.position.copy(pos);
  sphere.userData = { isDraggable: true, idTag: idTag };

  // Glowing halo
  const haloGeom = new THREE.SphereGeometry(0.14, 16, 16);
  const haloMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.22,
    wireframe: true
  });
  sphere.add(new THREE.Mesh(haloGeom, haloMat));

  dynamicObjectsGroup.add(sphere);
  draggableMeshes.push(sphere);
  return sphere;
}

function createDashedLine(start, end, colorHex) {
  const points = [start, end];
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineDashedMaterial({
    color: colorHex,
    dashSize: 0.14,
    gapSize: 0.08,
    transparent: true,
    opacity: 0.55
  });
  const line = new THREE.Line(geom, mat);
  line.computeLineDistances();
  dynamicObjectsGroup.add(line);
  return line;
}

// ==========================================================================
// 5. TWO-GRID ENGINE & TRANSFORMATION FLOW (I -> M)
// ==========================================================================
function renderTransformedGrid(targetMatrix, progress = 1.0) {
  while (transformedGridGroup.children.length > 0) {
    const obj = transformedGridGroup.children[0];
    transformedGridGroup.remove(obj);
  }

  if (!state.showTransformedGrid) return;

  // Continuous linear interpolation from Identity I -> Target Matrix M
  const a = 1.0 + (targetMatrix.a - 1.0) * progress;
  const b = 0.0 + (targetMatrix.b - 0.0) * progress;
  const c = 0.0 + (targetMatrix.c - 0.0) * progress;
  const d = 1.0 + (targetMatrix.d - 1.0) * progress;

  const size = 8;
  const step = 1;

  const lineMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.35 });
  const axisLineMatX = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.65, linewidth: 2 });
  const axisLineMatY = new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.65, linewidth: 2 });

  for (let i = -size; i <= size; i += step) {
    // Vertical grid line (transformed X column)
    const p1 = new THREE.Vector3(a * i + b * (-size), c * i + d * (-size), 0);
    const p2 = new THREE.Vector3(a * i + b * size, c * i + d * size, 0);
    const geom1 = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    transformedGridGroup.add(new THREE.Line(geom1, i === 0 ? axisLineMatY : lineMat));

    // Horizontal grid line (transformed Y column)
    const p3 = new THREE.Vector3(a * (-size) + b * i, c * (-size) + d * i, 0);
    const p4 = new THREE.Vector3(a * size + b * i, c * size + d * i, 0);
    const geom2 = new THREE.BufferGeometry().setFromPoints([p3, p4]);
    transformedGridGroup.add(new THREE.Line(geom2, i === 0 ? axisLineMatX : lineMat));
  }

  // Transformed Basis Vectors: M*i and M*j
  const origin = new THREE.Vector3(0, 0, 0);
  const mi = new THREE.Vector3(a, c, 0);
  const mj = new THREE.Vector3(b, d, 0);
  createThickArrow(origin, mi, COLORS.basisI, 0.034, 0.24, 0.075, { name: 'Transformed Basis i (M·i)' });
  createThickArrow(origin, mj, COLORS.basisJ, 0.034, 0.24, 0.075, { name: 'Transformed Basis j (M·j)' });

  create3DLabel(`M·i [${a.toFixed(1)}, ${c.toFixed(1)}]`, new THREE.Vector3(mi.x + 0.25, mi.y + 0.1, 0), '#ef4444');
  create3DLabel(`M·j [${b.toFixed(1)}, ${d.toFixed(1)}]`, new THREE.Vector3(mj.x + 0.1, mj.y + 0.25, 0), '#10b981');
}

function setFlowProgress(val) {
  state.flowProgress = Math.max(0.0, Math.min(1.0, val));
  const badge = document.getElementById('flowProgressBadge');
  if (badge) badge.innerText = `${Math.round(state.flowProgress * 100)}% (I → M)`;
  const slider = document.getElementById('sl_flowProgress');
  if (slider) slider.value = state.flowProgress;
  renderActiveExperimentGraphics();
}

function toggleFlowPlayback() {
  state.flowPlaying = !state.flowPlaying;
  const btn = document.getElementById('btnPlayFlow');
  if (btn) btn.innerText = state.flowPlaying ? '⏸' : '▶';
  if (state.flowPlaying && state.flowProgress >= 1.0) {
    state.flowProgress = 0.0;
  }
}

// ==========================================================================
// 6. 17 MODULAR MATHEMATICAL EXPERIMENTS
// ==========================================================================
const EXPERIMENTS = {
  1: {
    id: 1,
    slug: 'vector',
    category: 'FOUNDATIONS',
    symbol: '↗',
    title: 'A Vector in 3D Space',
    subtitle: 'A vector is an arrow through space having magnitude (length) and direction. It connects the origin to (x, y, z).',
    formula: 'v = x·i + y·j + z·k',
    python: (s) => `import numpy as np\nv = np.array([${s.v.x.toFixed(1)}, ${s.v.y.toFixed(1)}, ${s.v.z.toFixed(1)}])\nprint("Vector v =", v)\nprint("Magnitude =", np.linalg.norm(v))`,
    presets: [
      { label: '3-4-0 (Flat 2D)', action: () => setVectorV(3, 4, 0) },
      { label: '2-3-4 (Full 3D)', action: () => setVectorV(2, 3, 4) },
      { label: '-3-2-2 (Negative)', action: () => setVectorV(-3, -2, -2) }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--axis-x)">X Component</span><span class="control-value" id="val_vx">${state.v.x.toFixed(1)}</span></div>
          <div class="slider-container"><input type="range" id="sl_vx" min="-5" max="5" step="0.5" value="${state.v.x}"></div>
        </div>
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--axis-y)">Y Component</span><span class="control-value" id="val_vy">${state.v.y.toFixed(1)}</span></div>
          <div class="slider-container"><input type="range" id="sl_vy" min="-5" max="5" step="0.5" value="${state.v.y}"></div>
        </div>
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--axis-z)">Z Component</span><span class="control-value" id="val_vz">${state.v.z.toFixed(1)}</span></div>
          <div class="slider-container"><input type="range" id="sl_vz" min="-5" max="5" step="0.5" value="${state.v.z}"></div>
        </div>
      `;
      ['x', 'y', 'z'].forEach(k => {
        document.getElementById(`sl_v${k}`).addEventListener('input', (e) => {
          state.v[k] = parseFloat(e.target.value);
          document.getElementById(`val_v${k}`).innerText = state.v[k].toFixed(1);
          renderActiveExperimentGraphics();
        });
      });
    },
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const vEnd = new THREE.Vector3(state.v.x, state.v.y, state.v.z);
      createThickArrow(origin, vEnd, COLORS.vectorV, 0.034, 0.25, 0.08, { name: 'Vector v' });
      createDraggableEndpoint(vEnd, COLORS.vectorV, 'v');
      addTracePoint(vEnd);

      if (state.showDropLines) {
        const xyProj = new THREE.Vector3(state.v.x, state.v.y, 0);
        const xProj = new THREE.Vector3(state.v.x, 0, 0);
        const yProj = new THREE.Vector3(0, state.v.y, 0);
        createDashedLine(vEnd, xyProj, COLORS.dropLine);
        createDashedLine(xyProj, xProj, COLORS.axisY);
        createDashedLine(xyProj, yProj, COLORS.axisX);
      }

      updateMetrics({
        'Vector v': `⟨${state.v.x.toFixed(1)}, ${state.v.y.toFixed(1)}, ${state.v.z.toFixed(1)}⟩`,
        'Length |v|': vEnd.length().toFixed(2),
        'Floor Dist': Math.hypot(state.v.x, state.v.y).toFixed(2),
        'Z Height': state.v.z.toFixed(2)
      });
    }
  },

  2: {
    id: 2,
    slug: 'magnitude',
    category: 'FOUNDATIONS',
    symbol: '|v|',
    title: 'Vector Length (Magnitude)',
    subtitle: 'Length is Euclidean distance. In 3D, it is the Pythagorean theorem applied twice: |v| = √(x² + y² + z²).',
    formula: 'd_xy = √(x² + y²)<br>|v| = √(d_xy² + z²)',
    python: (s) => `import numpy as np\nv = np.array([${s.v.x.toFixed(1)}, ${s.v.y.toFixed(1)}, ${s.v.z.toFixed(1)}])\nlength = np.linalg.norm(v)\nprint("|v| =", length)`,
    presets: [
      { label: '3-4-0 (Len 5)', action: () => setVectorV(3, 4, 0) },
      { label: '1-2-2 (Len 3)', action: () => setVectorV(1, 2, 2) },
      { label: '2-3-6 (Len 7)', action: () => setVectorV(2, 3, 6) }
    ],
    buildControls: (container) => EXPERIMENTS[1].buildControls(container),
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const vEnd = new THREE.Vector3(state.v.x, state.v.y, state.v.z);
      const xyProj = new THREE.Vector3(state.v.x, state.v.y, 0);
      const xProj = new THREE.Vector3(state.v.x, 0, 0);

      createThickArrow(origin, vEnd, COLORS.vectorV, 0.034, 0.25, 0.08, { name: 'Vector v' });
      createDraggableEndpoint(vEnd, COLORS.vectorV, 'v');

      // Connected Right Triangles
      createThickArrow(origin, xProj, COLORS.axisX, 0.02, 0.15, 0.045);
      createThickArrow(xProj, xyProj, COLORS.axisY, 0.02, 0.15, 0.045);
      createThickArrow(origin, xyProj, COLORS.vectorProj, 0.024, 0.18, 0.055);
      createThickArrow(xyProj, vEnd, COLORS.axisZ, 0.02, 0.15, 0.045);

      const d_xy = Math.hypot(state.v.x, state.v.y);
      const len = vEnd.length();

      updateMetrics({
        'Floor d_xy': d_xy.toFixed(2),
        '3D Length |v|': len.toFixed(2),
        'Floor Tri': `${state.v.x.toFixed(1)}² + ${state.v.y.toFixed(1)}²`,
        '3D Tri': `${d_xy.toFixed(2)}² + ${state.v.z.toFixed(1)}²`
      });
    }
  },

  3: {
    id: 3,
    slug: 'addition',
    category: 'FOUNDATIONS',
    symbol: '+',
    title: 'Vector Addition (a + b)',
    subtitle: 'Vector addition combines journeys: travel along vector a, then continue along vector b to reach sum a + b.',
    formula: 'a + b = [a_x + b_x, a_y + b_y]',
    python: (s) => `import numpy as np\na = np.array([${s.a.x.toFixed(1)}, ${s.a.y.toFixed(1)}])\nb = np.array([${s.b.x.toFixed(1)}, ${s.b.y.toFixed(1)}])\nsum_v = a + b\nprint("a + b =", sum_v)`,
    presets: [
      { label: 'Right Angle [3,0] + [0,2]', action: () => { setVectorA(3, 0); setVectorB(0, 2); } },
      { label: 'Opposing [3,2] + [-3,-2]', action: () => { setVectorA(3, 2); setVectorB(-3, -2); } },
      { label: 'Collinear [2,1] + [2,1]', action: () => { setVectorA(2, 1); setVectorB(2, 1); } }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--vec-a)">Vector a (X, Y)</span><span class="control-value">[${state.a.x.toFixed(1)}, ${state.a.y.toFixed(1)}]</span></div>
          <div class="slider-container">
            <input type="range" id="sl_ax" min="-4" max="4" step="0.5" value="${state.a.x}">
            <input type="range" id="sl_ay" min="-4" max="4" step="0.5" value="${state.a.y}">
          </div>
        </div>
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--vec-b)">Vector b (X, Y)</span><span class="control-value">[${state.b.x.toFixed(1)}, ${state.b.y.toFixed(1)}]</span></div>
          <div class="slider-container">
            <input type="range" id="sl_bx" min="-4" max="4" step="0.5" value="${state.b.x}">
            <input type="range" id="sl_by" min="-4" max="4" step="0.5" value="${state.b.y}">
          </div>
        </div>
      `;
      ['ax', 'ay', 'bx', 'by'].forEach(id => {
        document.getElementById(`sl_${id}`).addEventListener('input', (e) => {
          const vec = id.startsWith('a') ? state.a : state.b;
          vec[id[1]] = parseFloat(e.target.value);
          renderActiveExperimentGraphics();
        });
      });
    },
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const aEnd = new THREE.Vector3(state.a.x, state.a.y, 0);
      const bEnd = new THREE.Vector3(state.b.x, state.b.y, 0);
      const sumEnd = new THREE.Vector3(state.a.x + state.b.x, state.a.y + state.b.y, 0);

      createThickArrow(origin, aEnd, COLORS.vectorA, 0.032, 0.24, 0.075, { name: 'Vector a' });
      createThickArrow(origin, bEnd, COLORS.vectorB, 0.032, 0.24, 0.075, { name: 'Vector b' });
      createThickArrow(origin, sumEnd, COLORS.vectorRes, 0.036, 0.26, 0.085, { name: 'Sum a + b' });

      createDraggableEndpoint(aEnd, COLORS.vectorA, 'a');
      createDraggableEndpoint(bEnd, COLORS.vectorB, 'b');

      createDashedLine(aEnd, sumEnd, COLORS.vectorB);
      createDashedLine(bEnd, sumEnd, COLORS.vectorA);

      updateMetrics({
        'Vector a': `⟨${state.a.x.toFixed(1)}, ${state.a.y.toFixed(1)}⟩`,
        'Vector b': `⟨${state.b.x.toFixed(1)}, ${state.b.y.toFixed(1)}⟩`,
        'Sum a + b': `⟨${sumEnd.x.toFixed(1)}, ${sumEnd.y.toFixed(1)}⟩`,
        'Sum Length': sumEnd.length().toFixed(2)
      });
    }
  },

  4: {
    id: 4,
    slug: 'subtraction',
    category: 'FOUNDATIONS',
    symbol: '−',
    title: 'Vector Subtraction (a - b)',
    subtitle: 'a - b is the displacement vector pointing from the tip of b to the tip of a.',
    formula: 'a - b = [a_x - b_x, a_y - b_y]',
    python: (s) => `import numpy as np\na = np.array([${s.a.x.toFixed(1)}, ${s.a.y.toFixed(1)}])\nb = np.array([${s.b.x.toFixed(1)}, ${s.b.y.toFixed(1)}])\ndiff = a - b`,
    presets: [
      { label: 'Displacement [3,3]-[1,1]', action: () => { setVectorA(3, 3); setVectorB(1, 1); } },
      { label: 'Equal Vectors (Diff=0)', action: () => { setVectorA(2, 2); setVectorB(2, 2); } }
    ],
    buildControls: (container) => EXPERIMENTS[3].buildControls(container),
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const aEnd = new THREE.Vector3(state.a.x, state.a.y, 0);
      const bEnd = new THREE.Vector3(state.b.x, state.b.y, 0);
      const diffEnd = new THREE.Vector3(state.a.x - state.b.x, state.a.y - state.b.y, 0);

      createThickArrow(origin, aEnd, COLORS.vectorA, 0.032, 0.24, 0.075, { name: 'Vector a' });
      createThickArrow(origin, bEnd, COLORS.vectorB, 0.032, 0.24, 0.075, { name: 'Vector b' });
      createThickArrow(bEnd, aEnd, COLORS.vectorRes, 0.036, 0.26, 0.085, { name: 'Difference a - b' });

      createDraggableEndpoint(aEnd, COLORS.vectorA, 'a');
      createDraggableEndpoint(bEnd, COLORS.vectorB, 'b');

      updateMetrics({
        'Vector a': `⟨${state.a.x.toFixed(1)}, ${state.a.y.toFixed(1)}⟩`,
        'Vector b': `⟨${state.b.x.toFixed(1)}, ${state.b.y.toFixed(1)}⟩`,
        'Diff a - b': `⟨${diffEnd.x.toFixed(1)}, ${diffEnd.y.toFixed(1)}⟩`,
        'Displacement': diffEnd.length().toFixed(2)
      });
    }
  },

  5: {
    id: 5,
    slug: 'scalar',
    category: 'FOUNDATIONS',
    symbol: 'c·v',
    title: 'Scalar Multiplication (c · v)',
    subtitle: 'Multiplying by a scalar c scales magnitude along the vector line. Negative scalars reverse direction by 180° through zero.',
    formula: 'c · v = [c·v_x, c·v_y, c·v_z]',
    python: (s) => `import numpy as np\nv = np.array([2.0, 1.0, 1.0])\nc = ${s.scalar.toFixed(1)}\nres = c * v`,
    presets: [
      { label: 'Double (+2.0)', action: () => setScalar(2.0) },
      { label: 'Half (+0.5)', action: () => setScalar(0.5) },
      { label: 'Zero (0.0)', action: () => setScalar(0.0) },
      { label: 'Reverse (-1.0)', action: () => setScalar(-1.0) },
      { label: 'Reverse Double (-2.0)', action: () => setScalar(-2.0) }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--accent-indigo-light)">Scalar Multiplier (c)</span><span class="control-value" id="val_scalar">${state.scalar.toFixed(1)}</span></div>
          <div class="slider-container"><input type="range" id="sl_scalar" min="-3" max="3" step="0.2" value="${state.scalar}"></div>
        </div>
      `;
      document.getElementById('sl_scalar').addEventListener('input', (e) => {
        setScalar(parseFloat(e.target.value));
      });
    },
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const baseV = new THREE.Vector3(2, 1, 1);
      const scaledV = new THREE.Vector3(baseV.x * state.scalar, baseV.y * state.scalar, baseV.z * state.scalar);

      createThickArrow(origin, baseV, 0x475569, 0.02, 0.16, 0.05, { name: 'Base v [2,1,1]' });

      const col = state.scalar >= 0 ? COLORS.vectorRes : COLORS.axisX;
      if (Math.abs(state.scalar) > 0.01) {
        createThickArrow(origin, scaledV, col, 0.034, 0.25, 0.08, { name: 'Scaled c·v' });
        createDraggableEndpoint(scaledV, col, 'v');
      }

      updateMetrics({
        'Base v': '⟨2.0, 1.0, 1.0⟩',
        'Scalar c': state.scalar.toFixed(1),
        'Scaled c·v': `⟨${scaledV.x.toFixed(1)}, ${scaledV.y.toFixed(1)}, ${scaledV.z.toFixed(1)}⟩`,
        'Scaled Length': scaledV.length().toFixed(2)
      });
    }
  },

  6: {
    id: 6,
    slug: 'dot',
    category: 'FOUNDATIONS',
    symbol: 'a·b',
    title: 'Dot Product & Projection',
    subtitle: 'a · b measures directional alignment and geometric shadow. When perpendicular (90°), a · b = 0.',
    formula: 'a · b = |a||b|cos(θ) = a_x b_x + a_y b_y',
    python: (s) => `import numpy as np\na = np.array([${s.a.x.toFixed(1)}, ${s.a.y.toFixed(1)}])\nb = np.array([${s.b.x.toFixed(1)}, ${s.b.y.toFixed(1)}])\ndot = np.dot(a, b)`,
    presets: [
      { label: 'Parallel (0°)', action: () => setP6Angle(0) },
      { label: 'Orthogonal (90°)', action: () => setP6Angle(90) },
      { label: 'Opposite (180°)', action: () => setP6Angle(180) },
      { label: 'Acute (45°)', action: () => setP6Angle(45) }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="control-group">
          <div class="control-label-row"><span style="color:var(--vec-b)">Rotate Vector b Angle</span><span class="control-value" id="val_p6_angle">60°</span></div>
          <div class="slider-container"><input type="range" id="sl_p6_angle" min="0" max="360" step="5" value="60"></div>
        </div>
      `;
      document.getElementById('sl_p6_angle').addEventListener('input', (e) => {
        setP6Angle(parseFloat(e.target.value));
      });
    },
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const aEnd = new THREE.Vector3(state.a.x, state.a.y, 0);
      const bEnd = new THREE.Vector3(state.b.x, state.b.y, 0);

      createThickArrow(origin, aEnd, COLORS.vectorA, 0.032, 0.24, 0.075, { name: 'Fixed Vector a' });
      createThickArrow(origin, bEnd, COLORS.vectorB, 0.032, 0.24, 0.075, { name: 'Rotating Vector b' });
      createDraggableEndpoint(bEnd, COLORS.vectorB, 'b');

      const dot = state.a.x * state.b.x + state.a.y * state.b.y;
      const projScalar = dot / aEnd.lengthSq();
      const projVec = new THREE.Vector3(aEnd.x * projScalar, aEnd.y * projScalar, 0);

      if (Math.abs(projScalar) > 0.01) {
        createThickArrow(origin, projVec, COLORS.vectorProj, 0.034, 0.24, 0.08, { name: 'Projection Shadow' });
      }
      createDashedLine(bEnd, projVec, COLORS.dropLine);

      const angleDeg = ((Math.atan2(state.b.y, state.b.x) * 180) / Math.PI + 360) % 360;

      updateMetrics({
        'Angle θ': `${angleDeg.toFixed(0)}°`,
        'Dot Product': dot.toFixed(2),
        'Alignment': Math.abs(dot) < 0.05 ? 'Orthogonal (90°)' : dot > 0 ? 'Acute (Aligned)' : 'Obtuse (Opposing)',
        'Proj Length': projVec.length().toFixed(2)
      });
    }
  },

  7: {
    id: 7,
    slug: 'cross',
    category: 'FOUNDATIONS',
    symbol: 'a×b',
    title: 'Cross Product & Area',
    subtitle: 'a × b produces a 3D vector orthogonal to both inputs. Its length equals the area of the parallelogram formed by a and b.',
    formula: '|a × b| = Area = |a_x b_y - a_y b_x|',
    python: (s) => `import numpy as np\na = np.array([${s.a.x.toFixed(1)}, ${s.a.y.toFixed(1)}, 0.0])\nb = np.array([${s.b.x.toFixed(1)}, ${s.b.y.toFixed(1)}, 0.0])\ncross = np.cross(a, b)`,
    presets: [
      { label: 'Square Area 6 (X=3, Y=2)', action: () => { setVectorA(3, 0); setVectorB(0, 2); } },
      { label: 'Parallel Vectors (Area 0)', action: () => { setVectorA(3, 1); setVectorB(3, 1); } }
    ],
    buildControls: (container) => EXPERIMENTS[3].buildControls(container),
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const aEnd = new THREE.Vector3(state.a.x, state.a.y, 0);
      const bEnd = new THREE.Vector3(state.b.x, state.b.y, 0);
      const sumEnd = new THREE.Vector3(state.a.x + state.b.x, state.a.y + state.b.y, 0);
      const crossZ = state.a.x * state.b.y - state.a.y * state.b.x;
      const crossVec = new THREE.Vector3(0, 0, crossZ);

      createThickArrow(origin, aEnd, COLORS.vectorA, 0.032, 0.24, 0.075, { name: 'Vector a' });
      createThickArrow(origin, bEnd, COLORS.vectorB, 0.032, 0.24, 0.075, { name: 'Vector b' });
      if (Math.abs(crossZ) > 0.02) {
        createThickArrow(origin, crossVec, COLORS.vectorRes, 0.036, 0.26, 0.085, { name: 'Cross Product a × b' });
      }

      createDraggableEndpoint(aEnd, COLORS.vectorA, 'a');
      createDraggableEndpoint(bEnd, COLORS.vectorB, 'b');

      // Translucent Parallelogram Area
      const geom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0, aEnd.x, aEnd.y, 0, sumEnd.x, sumEnd.y, 0,
        0, 0, 0, sumEnd.x, sumEnd.y, 0, bEnd.x, bEnd.y, 0
      ]);
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
      dynamicObjectsGroup.add(new THREE.Mesh(geom, mat));

      // Crisp luminous edge border
      const edgePts = [origin, aEnd, sumEnd, bEnd];
      const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePts);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.65 });
      dynamicObjectsGroup.add(new THREE.LineLoop(edgeGeom, edgeMat));

      createDashedLine(aEnd, sumEnd, COLORS.vectorB);
      createDashedLine(bEnd, sumEnd, COLORS.vectorA);

      updateMetrics({
        'Cross a × b': `⟨0, 0, ${crossZ.toFixed(2)}⟩`,
        'Area': Math.abs(crossZ).toFixed(2),
        'Direction': crossZ >= 0 ? '+Z (Outward)' : '-Z (Inward)',
        'Orthogonality': '90° to a & b'
      });
    }
  },

  8: {
    id: 8,
    slug: 'basis',
    category: 'FOUNDATIONS',
    symbol: 'i,j,k',
    title: 'Basis Vectors & Coordinates',
    subtitle: 'Coordinates (x, y, z) are simply scalar weights scaling the unit standard basis vectors i, j, k.',
    formula: 'v = x·i + y·j + z·k<br>i=[1,0,0], j=[0,1,0], k=[0,0,1]',
    python: (s) => `import numpy as np\ni, j, k = np.eye(3)\nv = ${s.v.x.toFixed(1)}*i + ${s.v.y.toFixed(1)}*j + ${s.v.z.toFixed(1)}*k`,
    presets: [
      { label: 'Standard [3,2,1]', action: () => setVectorV(3, 2, 1) },
      { label: 'Pure X [4,0,0]', action: () => setVectorV(4, 0, 0) },
      { label: 'Pure Y [0,4,0]', action: () => setVectorV(0, 4, 0) },
      { label: 'Pure Z [0,0,4]', action: () => setVectorV(0, 0, 4) }
    ],
    buildControls: (container) => EXPERIMENTS[1].buildControls(container),
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const xi = new THREE.Vector3(state.v.x, 0, 0);
      const xiyj = new THREE.Vector3(state.v.x, state.v.y, 0);
      const vEnd = new THREE.Vector3(state.v.x, state.v.y, state.v.z);

      createThickArrow(origin, xi, COLORS.basisI, 0.024, 0.16, 0.05);
      createThickArrow(xi, xiyj, COLORS.basisJ, 0.024, 0.16, 0.05);
      createThickArrow(xiyj, vEnd, COLORS.basisK, 0.024, 0.16, 0.05);
      createThickArrow(origin, vEnd, COLORS.vectorV, 0.036, 0.26, 0.085, { name: 'Combined Vector v' });

      createDraggableEndpoint(vEnd, COLORS.vectorV, 'v');

      updateMetrics({
        'Basis i (X)': state.v.x.toFixed(1),
        'Basis j (Y)': state.v.y.toFixed(1),
        'Basis k (Z)': state.v.z.toFixed(1),
        'Result v': `⟨${state.v.x.toFixed(1)}, ${state.v.y.toFixed(1)}, ${state.v.z.toFixed(1)}⟩`
      });
    }
  },

  9: {
    id: 9,
    slug: 'matrix-machine',
    category: 'TRANSFORMATIONS',
    symbol: 'M',
    title: 'Matrix as a Space Machine',
    subtitle: 'A matrix is a machine: feed in vector v, and it produces transformed vector Mv by warping the coordinate space.',
    formula: 'M · v = [a·x + b·y, c·x + d·y]',
    python: (s) => `import numpy as np\nM = np.array([[${s.M.a.toFixed(2)}, ${s.M.b.toFixed(2)}], [${s.M.c.toFixed(2)}, ${s.M.d.toFixed(2)}]])\nv = np.array([2.0, 1.0])\nres = M @ v`,
    presets: [
      { label: 'Identity (No change)', action: () => setMatrixM(1, 0, 0, 1) },
      { label: 'Stretch X (2x)', action: () => setMatrixM(2, 0, 0, 1) },
      { label: 'Stretch Y (2x)', action: () => setMatrixM(1, 0, 0, 2) },
      { label: 'Rotate 90°', action: () => setMatrixM(0, -1, 1, 0) },
      { label: 'Shear X', action: () => setMatrixM(1, 1.2, 0, 1) }
    ],
    buildControls: (container) => buildMatrixEditorControls(container),
    render: () => renderMatrixTransformScene()
  },

  10: {
    id: 10,
    slug: 'grid-transform',
    category: 'TRANSFORMATIONS',
    symbol: '⊞',
    title: 'Transforming the Entire Grid',
    subtitle: 'A matrix deforms every point and line in the entire space simultaneously. The columns of M show where basis vectors land.',
    formula: 'M = [ M·i | M·j ]',
    python: (s) => `import numpy as np\nM = np.array([[${s.M.a.toFixed(2)}, ${s.M.b.toFixed(2)}], [${s.M.c.toFixed(2)}, ${s.M.d.toFixed(2)}]])\n# Columns are transformed basis vectors i and j!`,
    presets: [
      { label: 'Identity Grid', action: () => setMatrixM(1, 0, 0, 1) },
      { label: 'Sheared Space', action: () => setMatrixM(1, 1.5, 0, 1) },
      { label: 'Rotated 45°', action: () => setMatrixM(0.707, -0.707, 0.707, 0.707) },
      { label: '1D Line Collapse', action: () => setMatrixM(1, 1, 1, 1) }
    ],
    buildControls: (container) => buildMatrixEditorControls(container),
    render: () => renderMatrixTransformScene()
  },

  11: {
    id: 11,
    slug: 'matrix-arithmetic',
    category: 'TRANSFORMATIONS',
    symbol: 'M×v',
    title: 'Matrix × Vector Arithmetic',
    subtitle: 'Component arithmetic: new_x = a·x + b·y, new_y = c·x + d·y. Each row of M executes a dot product with vector v.',
    formula: 'Row 1 · v = a·x + b·y<br>Row 2 · v = c·x + d·y',
    python: (s) => `import numpy as np\nM = np.array([[${s.M.a.toFixed(2)}, ${s.M.b.toFixed(2)}], [${s.M.c.toFixed(2)}, ${s.M.d.toFixed(2)}]])\nv = np.array([2.0, 1.0])\nres = M @ v`,
    presets: [
      { label: 'Standard [[2,1],[1,3]]', action: () => setMatrixM(2, 1, 1, 3) },
      { label: 'Reflection [[-1,0],[0,1]]', action: () => setMatrixM(-1, 0, 0, 1) }
    ],
    buildControls: (container) => buildMatrixEditorControls(container),
    render: () => renderMatrixTransformScene()
  },

  12: {
    id: 12,
    slug: 'matrix-mult',
    category: 'TRANSFORMATIONS',
    symbol: 'AB≠BA',
    title: 'Matrix Multiplication (AB ≠ BA)',
    subtitle: 'Composition of transformations is non-commutative! Rotating then shearing produces a completely different result than shearing then rotating.',
    formula: 'A = Rotate(θ), B = Shear(k)<br>AB ≠ BA in 3D space',
    python: (s) => `import numpy as np\nA = np.array([[0, -1], [1, 0]])\nB = np.array([[1, 1.5], [0, 1]])\nprint("AB == BA?", np.array_equal(A @ B, B @ A))`,
    presets: [
      { label: 'Apply B then A (AB·v)', action: () => setMultOrder('AB') },
      { label: 'Apply A then B (BA·v)', action: () => setMultOrder('BA') }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="btn-action-row" style="margin-bottom:10px;">
          <button id="btn_mult_ab" class="btn-action ${state.multOrder==='AB'?'primary':''}">Order AB (Shear → Rotate)</button>
          <button id="btn_mult_ba" class="btn-action ${state.multOrder==='BA'?'primary':''}">Order BA (Rotate → Shear)</button>
        </div>
        <div class="control-group">
          <div class="control-label-row"><span>Matrix A Rotation</span><span class="control-value" id="val_mrot">${state.matRotDeg}°</span></div>
          <div class="slider-container"><input type="range" id="sl_mrot" min="0" max="180" step="5" value="${state.matRotDeg}"></div>
        </div>
        <div class="control-group">
          <div class="control-label-row"><span>Matrix B Shear</span><span class="control-value" id="val_mshear">${state.matShearK.toFixed(1)}</span></div>
          <div class="slider-container"><input type="range" id="sl_mshear" min="-2" max="2" step="0.2" value="${state.matShearK}"></div>
        </div>
      `;
      document.getElementById('btn_mult_ab').addEventListener('click', () => setMultOrder('AB'));
      document.getElementById('btn_mult_ba').addEventListener('click', () => setMultOrder('BA'));
      document.getElementById('sl_mrot').addEventListener('input', (e) => {
        state.matRotDeg = parseFloat(e.target.value);
        document.getElementById('val_mrot').innerText = `${state.matRotDeg}°`;
        renderActiveExperimentGraphics();
      });
      document.getElementById('sl_mshear').addEventListener('input', (e) => {
        state.matShearK = parseFloat(e.target.value);
        document.getElementById('val_mshear').innerText = state.matShearK.toFixed(1);
        renderActiveExperimentGraphics();
      });
    },
    render: () => {
      const rad = (state.matRotDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const k = state.matShearK;

      let finalM;
      if (state.multOrder === 'AB') {
        finalM = { a: cos, b: cos * k - sin, c: sin, d: sin * k + cos };
      } else {
        finalM = { a: cos + k * sin, b: -sin + k * cos, c: sin, d: cos };
      }

      state.M = finalM;
      renderTransformedGrid(finalM, state.flowProgress);

      const origin = new THREE.Vector3(0, 0, 0);
      const inputV = new THREE.Vector3(2, 1, 0);
      const outV = new THREE.Vector3(finalM.a * inputV.x + finalM.b * inputV.y, finalM.c * inputV.x + finalM.d * inputV.y, 0);

      createThickArrow(origin, inputV, 0x475569, 0.022, 0.16, 0.05, { name: 'Input v' });
      createThickArrow(origin, outV, COLORS.vectorRes, 0.036, 0.26, 0.085, { name: 'Transformed v' });

      updateMetrics({
        'Order': state.multOrder === 'AB' ? 'AB (Shear → Rotate)' : 'BA (Rotate → Shear)',
        'Output Vector': `⟨${outV.x.toFixed(2)}, ${outV.y.toFixed(2)}⟩`,
        'Rotation θ': `${state.matRotDeg}°`,
        'Shear k': state.matShearK.toFixed(1)
      });
    }
  },

  13: {
    id: 13,
    slug: 'determinant',
    category: 'TRANSFORMATIONS',
    symbol: 'det',
    title: 'Determinant (Area Scaling & Collapse)',
    subtitle: 'det(M) measures the factor by which area changes. When det = 0, 2D space collapses into a flat 1D line!',
    formula: 'det(M) = ad - bc<br>Area_new = |det(M)| · Area_orig',
    python: (s) => `import numpy as np\nM = np.array([[${s.M.a.toFixed(2)}, ${s.M.b.toFixed(2)}], [${s.M.c.toFixed(2)}, ${s.M.d.toFixed(2)}]])\ndet = np.linalg.det(M)\nprint("det(M) =", det)`,
    presets: [
      { label: 'Area x3 (det = 3.0)', action: () => setMatrixM(2, 0, 0, 1.5) },
      { label: '1D Line Collapse (det = 0)', action: () => setMatrixM(1, 1, 1, 1) },
      { label: 'Orientation Flip (det = -1)', action: () => setMatrixM(-1, 0, 0, 1) }
    ],
    buildControls: (container) => buildMatrixEditorControls(container),
    render: () => renderMatrixTransformScene()
  },

  14: {
    id: 14,
    slug: 'inverse',
    category: 'TRANSFORMATIONS',
    symbol: 'M⁻¹',
    title: 'Matrix Inverse (Undoing Space)',
    subtitle: 'The inverse matrix M⁻¹ is the undo button: M⁻¹(Mv) = v. If det(M) = 0, space collapsed and cannot be inverted.',
    formula: 'M⁻¹ · M = I = [[1, 0], [0, 1]]',
    python: (s) => `import numpy as np\nM = np.array([[1.5, 0.5], [0.0, 1.2]])\nM_inv = np.linalg.inv(M)\nprint("M_inv @ M == I?", np.allclose(M_inv @ M, np.eye(2)))`,
    presets: [
      { label: '1. Original Space', action: () => setInvStep(0) },
      { label: '2. Apply Matrix M', action: () => setInvStep(1) },
      { label: '3. Apply Inverse M⁻¹', action: () => setInvStep(2) }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="btn-action-row">
          <button id="btn_inv_0" class="btn-action ${state.invStep===0?'primary':''}">1. Original</button>
          <button id="btn_inv_1" class="btn-action ${state.invStep===1?'primary':''}">2. Apply M</button>
          <button id="btn_inv_2" class="btn-action ${state.invStep===2?'primary':''}">3. Apply M⁻¹</button>
        </div>
      `;
      [0, 1, 2].forEach(step => {
        document.getElementById(`btn_inv_${step}`).addEventListener('click', () => setInvStep(step));
      });
    },
    render: () => {
      const M = { a: 1.5, b: 0.5, c: 0.0, d: 1.2 };
      const det = M.a * M.d - M.b * M.c;

      let curM = { a: 1, b: 0, c: 0, d: 1 };
      if (state.invStep === 1) curM = M;
      else if (state.invStep === 2) curM = { a: 1, b: 0, c: 0, d: 1 };

      renderTransformedGrid(curM, 1.0);

      const origin = new THREE.Vector3(0, 0, 0);
      const inputV = new THREE.Vector3(2, 1, 0);
      let curV = inputV.clone();
      if (state.invStep === 1) curV = new THREE.Vector3(M.a * 2 + M.b * 1, M.c * 2 + M.d * 1, 0);

      createThickArrow(origin, curV, COLORS.vectorRes, 0.036, 0.26, 0.085, { name: 'Vector' });

      updateMetrics({
        'Inverse Step': state.invStep === 0 ? '1. Original (I)' : state.invStep === 1 ? '2. Warped (M)' : '3. Restored (M⁻¹M = I)',
        'Position': `⟨${curV.x.toFixed(2)}, ${curV.y.toFixed(2)}⟩`,
        'det(M)': det.toFixed(2),
        'Invertible?': 'Yes (det ≠ 0)'
      });
    }
  },

  15: {
    id: 15,
    slug: 'many-vectors',
    category: 'COMPUTATION',
    symbol: '···',
    title: 'Many Vectors at Once (Batching)',
    subtitle: 'In computer graphics and AI, we transform arrays of hundreds or thousands of vectors simultaneously with one shared matrix.',
    formula: 'Transformed_Batch = Vectors @ M.T',
    python: (s) => `import numpy as np\nvectors = np.random.randn(${s.cloudCount}, 2)\nM = np.array([[0.866, -0.5], [0.5, 0.866]])\ntransformed = vectors @ M.T`,
    presets: [
      { label: 'Rotate 30°', action: () => setCloudAngle(30) },
      { label: 'Rotate 90°', action: () => setCloudAngle(90) },
      { label: 'Rotate 180°', action: () => setCloudAngle(180) }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div class="control-group">
          <div class="control-label-row"><span>Batch Rotation Angle</span><span class="control-value" id="val_cloud_deg">${state.cloudAngle}°</span></div>
          <div class="slider-container"><input type="range" id="sl_cloud_deg" min="0" max="360" step="5" value="${state.cloudAngle}"></div>
        </div>
      `;
      document.getElementById('sl_cloud_deg').addEventListener('input', (e) => {
        setCloudAngle(parseFloat(e.target.value));
      });
    },
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const rad = (state.cloudAngle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const count = state.cloudCount;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = 2.2 + 0.9 * Math.sin(i * 3);
        const origX = r * Math.cos(angle);
        const origY = r * Math.sin(angle);
        const transX = cos * origX - sin * origY;
        const transY = sin * origX + cos * origY;
        createThickArrow(origin, new THREE.Vector3(transX, transY, 0), COLORS.vectorA, 0.015, 0.11, 0.04);
      }

      updateMetrics({
        'Vector Count': `${count} Vectors`,
        'Array Shape': `[${count}, 2]`,
        'Operation': 'Batch Matrix Mul (@)',
        'Rotation': `${state.cloudAngle}°`
      });
    }
  },

  16: {
    id: 16,
    slug: 'vectorization',
    category: 'COMPUTATION',
    symbol: '⚡',
    title: 'What Vectorization Means',
    subtitle: 'Python loops process 1 element at a time. Vectorization passes the entire contiguous memory block to compiled SIMD BLAS code in 1 single call.',
    formula: 'Loop: O(N) interpreter calls<br>Vectorized: 1 call @ native hardware SIMD',
    python: (s) => `# Slow Interpreter Loop:\nres = [M @ v for v in vectors]\n\n# Fast Vectorized (100x+ faster):\nres = vectors @ M.T`,
    presets: [
      { label: 'Demonstrate SIMD Batch', action: () => showToast('⚡ Contiguous array processed in single hardware instruction!') }
    ],
    buildControls: (container) => {
      container.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.5;">
          Vectorization eliminates interpreter overhead by aligning vectors in contiguous C-order memory and issuing vector instructions to the CPU.
        </div>
      `;
    },
    render: () => {
      EXPERIMENTS[15].render();
      updateMetrics({
        'Approach': 'SIMD Vectorized Batch',
        'Speedup': '~130x Faster',
        'Memory Access': 'Contiguous C-Order',
        'CPU Utilization': 'Full Parallel BLAS'
      });
    }
  },

  17: {
    id: 17,
    slug: 'simd',
    category: 'COMPUTATION',
    symbol: 'CPU',
    title: 'SIMD CPU Hardware Lanes',
    subtitle: 'SIMD (Single Instruction Multiple Data): 128-bit/256-bit CPU registers execute multiple arithmetic operations in 1 single hardware cycle.',
    formula: '128-bit = 4 x 32-bit float lanes<br>256-bit = 8 x 32-bit float lanes',
    python: (s) => `# 128-bit Vector Register (4 x float32):\n# VMULPS ymm0, ymm1 -> 4 parallel multiplications in 1 cycle!`,
    presets: [
      { label: '128-bit Mode (4 Lanes)', action: () => setSimdMode(128) },
      { label: '256-bit Mode (8 Lanes)', action: () => setSimdMode(256) },
      { label: 'Execute 1 SIMD Cycle', action: () => execSimd() }
    ],
    buildControls: (container) => {
      const is256 = state.simdMode === 256;
      const count = is256 ? 8 : 4;
      let lanesHtml = '<div style="display:grid; grid-template-columns: repeat(' + (is256 ? 4 : 4) + ', 1fr); gap:6px; margin-bottom:10px;">';
      for (let i = 0; i < count; i++) {
        const baseVal = (i + 1) * 1.0;
        const val = state.simdExecuted ? baseVal * state.simdScalar : baseVal;
        lanesHtml += `
          <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:4px; padding:6px; text-align:center;">
            <div style="font-size:0.62rem; color:var(--text-muted);">Lane ${i}</div>
            <div style="font-family:var(--font-mono); font-size:0.8rem; color:${state.simdExecuted?'var(--accent-indigo-light)':'var(--text-primary)'};">${val.toFixed(1)}</div>
          </div>
        `;
      }
      lanesHtml += '</div>';

      container.innerHTML = `
        ${lanesHtml}
        <div class="btn-action-row">
          <button class="btn-action primary" onclick="execSimd()">⚡ Execute 1 SIMD Cycle</button>
          <button class="btn-action" onclick="resetSimd()">↺ Reset</button>
        </div>
      `;
    },
    render: () => {
      const origin = new THREE.Vector3(0, 0, 0);
      const is256 = state.simdMode === 256;
      const count = is256 ? 8 : 4;
      const scale = state.simdExecuted ? state.simdScalar : 1.0;
      const col = state.simdExecuted ? COLORS.vectorRes : COLORS.vectorV;

      for (let i = 0; i < count; i++) {
        const x = (i + 1) * 0.7 * scale;
        const y = Math.sin(i * 0.8) * 2;
        createThickArrow(origin, new THREE.Vector3(x, y, 0), col, 0.022, 0.15, 0.05, { name: `SIMD Lane ${i}` });
      }

      updateMetrics({
        'Register Width': `${state.simdMode}-bit`,
        'Active Lanes': `${count} Floating-Point Lanes`,
        'Cycles Spent': state.simdExecuted ? '1 Hardware Cycle' : 'Ready',
        'Instruction': `VMULPS (Scale ×${state.simdScalar})`
      });
    }
  }
};

// ==========================================================================
// 7. MATRIX HELPER RENDERERS & "SPACE ANALYSIS"
// ==========================================================================
function buildMatrixEditorControls(container) {
  container.innerHTML = `
    <div class="matrix-editor-card">
      <div class="matrix-editor-header">
        <span>2x2 Matrix Entries</span>
        <span id="editorDetBadge" style="color:var(--accent-amber); font-family:var(--font-mono);">det: 1.00</span>
      </div>
      <div class="matrix-brackets-grid">
        <div class="matrix-input-cell"><label>a</label><input type="number" id="mat_a" step="0.2" value="${state.M.a}"></div>
        <div class="matrix-input-cell"><label>b</label><input type="number" id="mat_b" step="0.2" value="${state.M.b}"></div>
        <div class="matrix-input-cell"><label>c</label><input type="number" id="mat_c" step="0.2" value="${state.M.c}"></div>
        <div class="matrix-input-cell"><label>d</label><input type="number" id="mat_d" step="0.2" value="${state.M.d}"></div>
      </div>
    </div>
  `;
  ['a', 'b', 'c', 'd'].forEach(k => {
    document.getElementById(`mat_${k}`).addEventListener('input', (e) => {
      state.M[k] = parseFloat(e.target.value) || 0;
      renderActiveExperimentGraphics();
    });
  });
}

function renderMatrixTransformScene() {
  renderTransformedGrid(state.M, state.flowProgress);

  const origin = new THREE.Vector3(0, 0, 0);
  const inputV = new THREE.Vector3(2, 1, 0);
  const outX = state.M.a * inputV.x + state.M.b * inputV.y;
  const outY = state.M.c * inputV.x + state.M.d * inputV.y;
  const outV = new THREE.Vector3(outX, outY, 0);

  // Original Vector Ghost
  createThickArrow(origin, inputV, 0x475569, 0.022, 0.16, 0.05, { name: 'Input Vector v [2,1]' });
  // Transformed Vector Output
  createThickArrow(origin, outV, COLORS.vectorRes, 0.036, 0.26, 0.085, { name: 'Output Vector M·v' });

  // Unit Square Transformation Surface for Area/Determinant
  const mi = new THREE.Vector3(state.M.a, state.M.c, 0);
  const mj = new THREE.Vector3(state.M.b, state.M.d, 0);
  const corner = new THREE.Vector3(mi.x + mj.x, mi.y + mj.y, 0);

  const geom = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 0, mi.x, mi.y, 0, corner.x, corner.y, 0,
    0, 0, 0, corner.x, corner.y, 0, mj.x, mj.y, 0
  ]);
  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const mat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
  dynamicObjectsGroup.add(new THREE.Mesh(geom, mat));

  // Glowing perimeter border
  const borderPts = [origin, mi, corner, mj];
  const borderGeom = new THREE.BufferGeometry().setFromPoints(borderPts);
  const borderMat = new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.6 });
  dynamicObjectsGroup.add(new THREE.LineLoop(borderGeom, borderMat));

  const det = state.M.a * state.M.d - state.M.b * state.M.c;
  const detBadge = document.getElementById('editorDetBadge');
  if (detBadge) detBadge.innerText = `det: ${det.toFixed(2)}`;

  updateSpaceAnalysis(state.M, det);

  updateMetrics({
    'Basis M·i': `⟨${state.M.a.toFixed(2)}, ${state.M.c.toFixed(2)}⟩`,
    'Basis M·j': `⟨${state.M.b.toFixed(2)}, ${state.M.d.toFixed(2)}⟩`,
    'det(M)': det.toFixed(2),
    'Output Mv': `⟨${outX.toFixed(2)}, ${outY.toFixed(2)}⟩`
  });
}

function updateSpaceAnalysis(M, det) {
  const container = document.getElementById('dynamicSpaceAnalysisBox');
  if (!container) return;

  const isMatrixExp = state.activeExpId >= 9 && state.activeExpId <= 14;
  if (!isMatrixExp) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const scaleX = Math.hypot(M.a, M.c);
  const scaleY = Math.hypot(M.b, M.d);
  const isSingular = Math.abs(det) < 0.001;
  const orientation = det < 0 ? 'Flipped (-)' : 'Preserved (+)';
  const dimensionStatus = isSingular ? '2D → 1D Line Collapse' : '2D Plane Preserved';

  container.innerHTML = `
    <div class="space-analysis-card">
      <div class="space-analysis-title">Space Analysis (What Changed?)</div>
      <div class="space-analysis-grid">
        <div class="analysis-item"><span class="lbl">Scale X:</span><span class="val">×${scaleX.toFixed(2)}</span></div>
        <div class="analysis-item"><span class="lbl">Scale Y:</span><span class="val">×${scaleY.toFixed(2)}</span></div>
        <div class="analysis-item"><span class="lbl">Area Scale:</span><span class="val">×${Math.abs(det).toFixed(2)}</span></div>
        <div class="analysis-item"><span class="lbl">Orientation:</span><span class="val">${orientation}</span></div>
      </div>
      <div style="font-size:0.68rem; color:${isSingular?'var(--axis-x)':'var(--accent-indigo-light)'}; font-family:var(--font-mono); margin-top:4px;">
        ${dimensionStatus}
      </div>
    </div>
  `;
}

// ==========================================================================
// 8. CHALLENGES & GEOMETRIC VERIFIERS
// ==========================================================================
const CHALLENGES = {
  1: {
    title: 'Make Vectors a and b Perpendicular',
    desc: 'Rotate or adjust vector b until the dot product a · b = 0.0',
    expId: 6,
    verify: () => {
      const dot = state.a.x * state.b.x + state.a.y * state.b.y;
      return Math.abs(dot) < 0.08;
    }
  },
  2: {
    title: 'Create an Orientation Flip (det = -1.0)',
    desc: 'Adjust matrix M entries so that the determinant det(M) = -1.0',
    expId: 13,
    verify: () => {
      const det = state.M.a * state.M.d - state.M.b * state.M.c;
      return Math.abs(det - (-1.0)) < 0.1;
    }
  },
  3: {
    title: 'Collapse Space into a 1D Line (det = 0.0)',
    desc: 'Make the columns of matrix M linearly dependent so det(M) = 0',
    expId: 10,
    verify: () => {
      const det = state.M.a * state.M.d - state.M.b * state.M.c;
      return Math.abs(det) < 0.05;
    }
  },
  4: {
    title: 'Set Vector Magnitude to exactly 5.0',
    desc: 'Adjust vector v components so that |v| = √(x² + y² + z²) = 5.0',
    expId: 2,
    verify: () => {
      const len = Math.hypot(state.v.x, state.v.y, state.v.z);
      return Math.abs(len - 5.0) < 0.1;
    }
  },
  5: {
    title: 'Construct a Sum Vector with Length ≥ 6.0',
    desc: 'Position vectors a and b so that their sum a + b has magnitude ≥ 6.0',
    expId: 3,
    verify: () => {
      const sumLen = Math.hypot(state.a.x + state.b.x, state.a.y + state.b.y);
      return sumLen >= 6.0;
    }
  }
};

function checkChallengeVerification() {
  if (state.appMode !== 'challenge') return;
  const chal = CHALLENGES[state.activeChallengeId];
  if (!chal) return;

  const isSolved = chal.verify();
  const dot = document.querySelector('.challenge-dot');
  const text = document.getElementById('challengeStatusText');

  if (isSolved) {
    if (dot) {
      dot.className = 'challenge-dot solved';
    }
    if (text) text.innerText = '✓ Solved!';
    audio.triggerChime(880);
  } else {
    if (dot) {
      dot.className = 'challenge-dot pending';
    }
    if (text) text.innerText = 'Incomplete';
  }
}

// ==========================================================================
// 9. LAB NOTEBOOK (LOCAL STORAGE OBSERVATIONS)
// ==========================================================================
function getNotebookEntries() {
  try {
    return JSON.parse(localStorage.getItem('linear_lab_observations') || '[]');
  } catch (e) {
    return [];
  }
}

function saveCurrentObservation(customNote = '') {
  const entries = getNotebookEntries();
  const exp = EXPERIMENTS[state.activeExpId];
  const newEntry = {
    id: Date.now(),
    date: new Date().toLocaleTimeString(),
    expId: state.activeExpId,
    expTitle: exp.title,
    note: customNote || 'Exploration observation',
    state: {
      v: { ...state.v },
      a: { ...state.a },
      b: { ...state.b },
      M: { ...state.M },
      scalar: state.scalar
    }
  };
  entries.unshift(newEntry);
  localStorage.setItem('linear_lab_observations', JSON.stringify(entries));
  showToast('📝 Observation saved to Lab Notebook');
  renderNotebookModal();
}

function deleteObservation(id) {
  let entries = getNotebookEntries();
  entries = entries.filter(e => e.id !== id);
  localStorage.setItem('linear_lab_observations', JSON.stringify(entries));
  renderNotebookModal();
}

function loadObservation(id) {
  const entries = getNotebookEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  if (entry.state.v) Object.assign(state.v, entry.state.v);
  if (entry.state.a) Object.assign(state.a, entry.state.a);
  if (entry.state.b) Object.assign(state.b, entry.state.b);
  if (entry.state.M) Object.assign(state.M, entry.state.M);
  if (entry.state.scalar !== undefined) state.scalar = entry.state.scalar;

  closeAllModals();
  switchExperiment(entry.expId);
  showToast(`Loaded: ${entry.expTitle}`);
}

function renderNotebookModal() {
  const list = document.getElementById('notebookList');
  if (!list) return;
  const entries = getNotebookEntries();

  if (entries.length === 0) {
    list.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:20px 0;">No observations saved yet. Click 'Save Current State' or the 📝 icon to record one!</div>`;
    return;
  }

  list.innerHTML = entries.map(entry => `
    <div class="notebook-entry">
      <div class="notebook-entry-info">
        <div class="notebook-entry-title">${entry.expTitle}</div>
        <div class="notebook-entry-sub">${entry.date} • Exp #${entry.expId}</div>
        <div class="notebook-entry-note">"${entry.note}"</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="panel-mini-btn" onclick="loadObservation(${entry.id})" title="Load into 3D Space">↗</button>
        <button class="panel-mini-btn" onclick="deleteObservation(${entry.id})" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

// ==========================================================================
// 10. SCREENSHOT CAPTURE & SHAREABLE URL ENCODING
// ==========================================================================
function captureCanvasScreenshot() {
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');

  // Draw onto watermarked canvas
  const canvas = document.createElement('canvas');
  canvas.width = renderer.domElement.width;
  canvas.height = renderer.domElement.height;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);

    // Subtle Brand Watermark
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(232, 238, 247, 0.8)';
    ctx.fillText('LINEAR ALGEBRA LAB', 30, canvas.height - 35);
    ctx.font = '400 13px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(138, 150, 168, 0.6)';
    ctx.fillText('Explore mathematics through space', 30, canvas.height - 18);

    const link = document.createElement('a');
    link.download = `linear_algebra_lab_exp${state.activeExpId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('📸 High-resolution screenshot captured!');
  };
  img.src = dataUrl;
}

function serializeStateToUrl() {
  const exp = EXPERIMENTS[state.activeExpId];
  let params = new URLSearchParams();
  params.set('exp', exp.slug);

  if (state.activeExpId === 1 || state.activeExpId === 2 || state.activeExpId === 8) {
    params.set('vx', state.v.x.toFixed(1));
    params.set('vy', state.v.y.toFixed(1));
    params.set('vz', state.v.z.toFixed(1));
  } else if (state.activeExpId >= 3 && state.activeExpId <= 7) {
    params.set('ax', state.a.x.toFixed(1));
    params.set('ay', state.a.y.toFixed(1));
    params.set('bx', state.b.x.toFixed(1));
    params.set('by', state.b.y.toFixed(1));
  } else if (state.activeExpId >= 9 && state.activeExpId <= 14) {
    params.set('a', state.M.a.toFixed(2));
    params.set('b', state.M.b.toFixed(2));
    params.set('c', state.M.c.toFixed(2));
    params.set('d', state.M.d.toFixed(2));
  }

  const url = `${window.location.origin}${window.location.pathname}#${params.toString()}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 Share link copied to clipboard!');
  }).catch(() => {
    showToast(`URL: #${params.toString()}`);
  });
}

function deserializeStateFromUrl() {
  const hash = window.location.hash.substring(1);
  if (!hash) return;

  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : hash);
  const expSlug = hash.includes('?') ? hash.split('?')[0] : params.get('exp') || hash;

  const foundExp = Object.values(EXPERIMENTS).find(e => e.slug === expSlug || `#${e.slug}` === hash);
  if (foundExp) {
    state.activeExpId = foundExp.id;
  }

  if (params.has('vx')) state.v.x = parseFloat(params.get('vx'));
  if (params.has('vy')) state.v.y = parseFloat(params.get('vy'));
  if (params.has('vz')) state.v.z = parseFloat(params.get('vz'));

  if (params.has('ax')) state.a.x = parseFloat(params.get('ax'));
  if (params.has('ay')) state.a.y = parseFloat(params.get('ay'));
  if (params.has('bx')) state.b.x = parseFloat(params.get('bx'));
  if (params.has('by')) state.b.y = parseFloat(params.get('by'));

  if (params.has('a')) state.M.a = parseFloat(params.get('a'));
  if (params.has('b')) state.M.b = parseFloat(params.get('b'));
  if (params.has('c')) state.M.c = parseFloat(params.get('c'));
  if (params.has('d')) state.M.d = parseFloat(params.get('d'));
}

// ==========================================================================
// 11. CAMERA PERSPECTIVES & SMOOTH INTERPOLATION
// ==========================================================================
function tweenCameraTo(targetPos, targetLookAt = new THREE.Vector3(0, 0, 0), duration = 600) {
  if (state.reducedMotion) {
    camera.position.copy(targetPos);
    controls.target.copy(targetLookAt);
    controls.update();
    return;
  }

  const startPos = camera.position.clone();
  const startLook = controls.target.clone();
  const startTime = performance.now();

  cameraTween = {
    update: (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Smooth easeInOutCubic
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startLook, targetLookAt, ease);
      controls.update();

      if (progress >= 1.0) cameraTween = null;
    }
  };
}

function setCameraPerspective(perspective) {
  closeAllModals();
  const r = 12.5;
  if (perspective === 'isometric') {
    tweenCameraTo(new THREE.Vector3(7.5, 6.5, 9.5));
  } else if (perspective === 'top') {
    tweenCameraTo(new THREE.Vector3(0, 0, r));
  } else if (perspective === 'front') {
    tweenCameraTo(new THREE.Vector3(0, -r, 0.01));
  } else if (perspective === 'side') {
    tweenCameraTo(new THREE.Vector3(r, 0, 0.01));
  } else if (perspective === 'reset') {
    tweenCameraTo(new THREE.Vector3(7.5, 6.5, 9.5));
  }
}

// ==========================================================================
// 12. SPOTLIGHT COMMAND PALETTE (Ctrl+K or /)
// ==========================================================================
let paletteFilteredItems = [];
let paletteSelectedIndex = 0;

function getAllPaletteCommands() {
  const commands = [];

  // 17 Experiments
  Object.values(EXPERIMENTS).forEach(exp => {
    commands.push({
      category: exp.category,
      title: `${String(exp.id).padStart(2, '0')} ${exp.title}`,
      symbol: exp.symbol || '↗',
      action: () => switchExperiment(exp.id)
    });
  });

  // Camera Views
  commands.push(
    { category: 'CAMERA VIEWS', title: 'Isometric Perspective (Default)', symbol: '📐', action: () => setCameraPerspective('isometric') },
    { category: 'CAMERA VIEWS', title: 'Top Perspective (XY Plane)', symbol: '⬆', action: () => setCameraPerspective('top') },
    { category: 'CAMERA VIEWS', title: 'Front Perspective (XZ Plane)', symbol: '➡', action: () => setCameraPerspective('front') },
    { category: 'CAMERA VIEWS', title: 'Reset Camera View (R)', symbol: '↺', action: () => setCameraPerspective('reset') }
  );

  // Quick Actions & Modes
  commands.push(
    { category: 'QUICK ACTIONS', title: 'Toggle Focus Mode (F)', symbol: '⚡', action: () => toggleFocusMode() },
    { category: 'QUICK ACTIONS', title: 'Toggle Ambient Audio (M)', symbol: '♫', action: () => toggleAudioPlayback() },
    { category: 'QUICK ACTIONS', title: 'Trigger Transformation Flow (Space)', symbol: '🌀', action: () => toggleFlowPlayback() },
    { category: 'QUICK ACTIONS', title: 'Capture Watermarked Screenshot', symbol: '📸', action: () => captureCanvasScreenshot() },
    { category: 'QUICK ACTIONS', title: 'Copy Shareable Experiment URL', symbol: '🔗', action: () => serializeStateToUrl() },
    { category: 'QUICK ACTIONS', title: 'Save Observation to Notebook', symbol: '📝', action: () => saveCurrentObservation() }
  );

  return commands;
}

function openCommandPalette() {
  closeAllModals();
  const modal = document.getElementById('commandPaletteModal');
  const input = document.getElementById('paletteSearchInput');
  modal.classList.add('open');
  input.value = '';
  input.focus();
  filterPaletteCommands('');
}

function filterPaletteCommands(query) {
  const all = getAllPaletteCommands();
  const q = query.toLowerCase().trim();

  paletteFilteredItems = q ? all.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)) : all;
  paletteSelectedIndex = 0;
  renderPaletteResults();
}

function renderPaletteResults() {
  const container = document.getElementById('paletteResultsList');
  if (!container) return;

  if (paletteFilteredItems.length === 0) {
    container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:16px;">No matching experiments or actions found</div>`;
    return;
  }

  let html = '';
  let curCategory = '';

  paletteFilteredItems.forEach((item, index) => {
    if (item.category !== curCategory) {
      curCategory = item.category;
      html += `<div class="palette-group-title">${curCategory}</div>`;
    }
    const isSelected = index === paletteSelectedIndex;
    html += `
      <div class="palette-item ${isSelected?'selected':''}" data-index="${index}" onclick="executePaletteItem(${index})">
        <div class="palette-item-left">
          <span class="palette-item-symbol">${item.symbol}</span>
          <span>${item.title}</span>
        </div>
        <span class="shortcut-tag">↵ Select</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function executePaletteItem(index) {
  const item = paletteFilteredItems[index];
  if (item && item.action) {
    item.action();
  }
  closeAllModals();
}

// ==========================================================================
// 13. UI CONTROLLERS & EVENT BINDINGS
// ==========================================================================
function switchExperiment(id) {
  state.activeExpId = parseInt(id);
  const exp = EXPERIMENTS[state.activeExpId];
  if (!exp) return;

  // Clear trace
  clearTrace();

  // Update Status Badge
  document.getElementById('statusBadgeNum').innerText = String(exp.id).padStart(2, '0');
  document.getElementById('statusCategoryTag').innerText = exp.category;
  document.getElementById('statusActiveTitle').innerText = exp.title;
  document.getElementById('panelHeaderTitle').innerText = `${String(exp.id).padStart(2, '0')} — ${exp.title.toUpperCase()}`;

  // Update Guided Stepper
  document.getElementById('guidedStepCounter').innerText = `${String(exp.id).padStart(2, '0')} / 17`;

  // Show/Hide Transformation Flow timeline
  const isMatrixExp = state.activeExpId >= 9 && state.activeExpId <= 14;
  document.getElementById('flowScrubberBox').style.display = isMatrixExp ? 'flex' : 'none';

  // Build Presets
  const presetStrip = document.getElementById('dynamicPresetStrip');
  presetStrip.innerHTML = '';
  if (exp.presets) {
    exp.presets.forEach(p => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.innerText = p.label;
      chip.addEventListener('click', () => {
        p.action();
        renderActiveExperimentGraphics();
        audio.triggerChime(520);
      });
      presetStrip.appendChild(chip);
    });
  }

  // Build Contextual Controls
  const controlsContainer = document.getElementById('dynamicControlsContainer');
  controlsContainer.innerHTML = '';
  if (exp.buildControls) {
    exp.buildControls(controlsContainer);
  }

  // Update Info Modal Content
  document.getElementById('infoCategoryTag').innerText = exp.category;
  document.getElementById('infoTitle').innerText = `${String(exp.id).padStart(2, '0')} — ${exp.title}`;
  document.getElementById('infoSubtitle').innerText = exp.subtitle;
  document.getElementById('infoFormulaBox').innerHTML = exp.formula;
  document.getElementById('infoPythonSnippet').innerText = exp.python(state);

  // Update Math HUD
  document.getElementById('mathHudTitle').innerText = exp.title;
  document.getElementById('mathHudFormula').innerHTML = exp.formula;

  // Render 3D scene
  renderActiveExperimentGraphics();

  // Close Explorer modal
  document.getElementById('explorerModal').classList.remove('open');

  // Verify challenge if active
  checkChallengeVerification();
}

function renderActiveExperimentGraphics() {
  while (dynamicObjectsGroup.children.length > 0) {
    const obj = dynamicObjectsGroup.children[0];
    dynamicObjectsGroup.remove(obj);
  }
  draggableMeshes = [];

  const exp = EXPERIMENTS[state.activeExpId];
  if (exp && exp.render) {
    exp.render();
  }

  checkChallengeVerification();
}

function updateMetrics(metricsObj) {
  const box = document.getElementById('dynamicMetricsBox');
  box.innerHTML = '';
  Object.entries(metricsObj).forEach(([k, v]) => {
    const item = document.createElement('div');
    item.className = 'metric-item';
    item.innerHTML = `<span class="metric-label">${k}</span><span class="metric-val">${v}</span>`;
    box.appendChild(item);
  });

  // Also update Math HUD calculation line if open
  const mathHudCalc = document.getElementById('mathHudCalc');
  if (mathHudCalc) {
    const firstTwo = Object.entries(metricsObj).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' • ');
    mathHudCalc.innerText = firstTwo;
  }
}

function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop, .popover-menu').forEach(el => el.classList.remove('open'));
}

function toggleFocusMode() {
  state.focusMode = !state.focusMode;
  const topHeader = document.getElementById('topHeader');
  const bottomLeft = document.getElementById('bottomLeftStatus');
  const panel = document.getElementById('contextualPanel');
  const exitBtn = document.getElementById('btnExitFocus');
  const hint = document.getElementById('bottomHint');

  if (state.focusMode) {
    topHeader.style.opacity = '0';
    topHeader.style.pointerEvents = 'none';
    bottomLeft.style.opacity = '0';
    bottomLeft.style.pointerEvents = 'none';
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    if (hint) hint.style.opacity = '0';
    exitBtn.style.display = 'flex';
    closeAllModals();
    showToast('⚡ Focus Mode Activated (Press Esc to Exit)');
  } else {
    topHeader.style.opacity = '1';
    topHeader.style.pointerEvents = 'auto';
    bottomLeft.style.opacity = '1';
    bottomLeft.style.pointerEvents = 'auto';
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    if (hint) hint.style.opacity = '1';
    exitBtn.style.display = 'none';
  }
}

function setAppMode(mode) {
  state.appMode = mode;
  document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
  const activePill = document.getElementById(`btnMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
  if (activePill) activePill.classList.add('active');

  const guidedStepper = document.getElementById('guidedStepperRow');
  const challengeBanner = document.getElementById('challengeBanner');

  guidedStepper.style.display = mode === 'guided' ? 'flex' : 'none';
  challengeBanner.style.display = mode === 'challenge' ? 'flex' : 'none';

  if (mode === 'challenge') {
    const chal = CHALLENGES[state.activeChallengeId];
    document.getElementById('challengeTitle').innerText = chal.title;
    document.getElementById('challengeDesc').innerText = chal.desc;
    switchExperiment(chal.expId);
    showToast('🎯 Challenge Mode Active!');
  } else if (mode === 'guided') {
    showToast('🧭 Guided Mode: Exploring 01 → 17');
  }
}

function setViewMode(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.view-mode-btn[data-view="${mode}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const mathHud = document.getElementById('prominentMathHud');
  if (mode === 'space') {
    mathHud.style.display = 'none';
  } else {
    mathHud.style.display = 'block';
  }
}

// Preset Action Setters
function setVectorV(x, y, z) {
  state.v = { x, y, z };
  ['x', 'y', 'z'].forEach(k => {
    const el = document.getElementById(`sl_v${k}`);
    if (el) el.value = state.v[k];
    const valEl = document.getElementById(`val_v${k}`);
    if (valEl) valEl.innerText = state.v[k].toFixed(1);
  });
  renderActiveExperimentGraphics();
}

function setVectorA(x, y) {
  state.a.x = x; state.a.y = y;
  const sx = document.getElementById('sl_ax'); if (sx) sx.value = x;
  const sy = document.getElementById('sl_ay'); if (sy) sy.value = y;
  renderActiveExperimentGraphics();
}

function setVectorB(x, y) {
  state.b.x = x; state.b.y = y;
  const sx = document.getElementById('sl_bx'); if (sx) sx.value = x;
  const sy = document.getElementById('sl_by'); if (sy) sy.value = y;
  renderActiveExperimentGraphics();
}

function setScalar(c) {
  state.scalar = c;
  const sl = document.getElementById('sl_scalar'); if (sl) sl.value = c;
  const val = document.getElementById('val_scalar'); if (val) val.innerText = c.toFixed(1);
  renderActiveExperimentGraphics();
}

function setP6Angle(deg) {
  const rad = (deg * Math.PI) / 180;
  const len = Math.hypot(state.b.x, state.b.y) || 2.5;
  state.b.x = len * Math.cos(rad);
  state.b.y = len * Math.sin(rad);
  const sl = document.getElementById('sl_p6_angle'); if (sl) sl.value = deg;
  const val = document.getElementById('val_p6_angle'); if (val) val.innerText = `${deg}°`;
  renderActiveExperimentGraphics();
}

function setMatrixM(a, b, c, d) {
  state.M = { a, b, c, d };
  ['a', 'b', 'c', 'd'].forEach(k => {
    const el = document.getElementById(`mat_${k}`);
    if (el) el.value = state.M[k];
  });
  renderActiveExperimentGraphics();
}

function setMultOrder(order) {
  state.multOrder = order;
  renderActiveExperimentGraphics();
}

function setInvStep(step) {
  state.invStep = step;
  renderActiveExperimentGraphics();
}

function setCloudAngle(deg) {
  state.cloudAngle = deg;
  const sl = document.getElementById('sl_cloud_deg'); if (sl) sl.value = deg;
  const val = document.getElementById('val_cloud_deg'); if (val) val.innerText = `${deg}°`;
  renderActiveExperimentGraphics();
}

function setSimdMode(bits) {
  state.simdMode = bits;
  state.simdExecuted = false;
  EXPERIMENTS[17].buildControls(document.getElementById('dynamicControlsContainer'));
  renderActiveExperimentGraphics();
}

function execSimd() {
  state.simdExecuted = true;
  EXPERIMENTS[17].buildControls(document.getElementById('dynamicControlsContainer'));
  renderActiveExperimentGraphics();
  audio.triggerChime(750);
  showToast('⚡ SIMD hardware instruction executed in 1 CPU cycle!');
}

function resetSimd() {
  state.simdExecuted = false;
  EXPERIMENTS[17].buildControls(document.getElementById('dynamicControlsContainer'));
  renderActiveExperimentGraphics();
}

// ==========================================================================
// 14. 3D RAYCASTING & OBJECT DRAGGING
// ==========================================================================
function setupInteractionEvents() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(draggableMeshes, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target && !target.userData.isDraggable && target.parent) {
        target = target.parent;
      }

      if (target && target.userData.isDraggable) {
        isDragging = true;
        activeDragTarget = target;
        controls.enabled = false;

        const normal = new THREE.Vector3(0, 0, 1);
        dragPlane.setFromNormalAndCoplanarPoint(normal, activeDragTarget.position);
      }
    } else if (state.inspectMode) {
      const allDynamic = raycaster.intersectObjects(dynamicObjectsGroup.children, true);
      if (allDynamic.length > 0) {
        showInspectHud(allDynamic[0].object, e.clientX, e.clientY);
      }
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging || !activeDragTarget) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
      const snapX = Math.round(planeIntersect.x * 2) / 2;
      const snapY = Math.round(planeIntersect.y * 2) / 2;

      const tag = activeDragTarget.userData.idTag;
      if (tag === 'v') {
        state.v.x = snapX;
        state.v.y = snapY;
        const sx = document.getElementById('sl_vx'); if (sx) sx.value = snapX;
        const sy = document.getElementById('sl_vy'); if (sy) sy.value = snapY;
      } else if (tag === 'a') {
        state.a.x = snapX;
        state.a.y = snapY;
        const sx = document.getElementById('sl_ax'); if (sx) sx.value = snapX;
        const sy = document.getElementById('sl_ay'); if (sy) sy.value = snapY;
      } else if (tag === 'b') {
        state.b.x = snapX;
        state.b.y = snapY;
        const sx = document.getElementById('sl_bx'); if (sx) sx.value = snapX;
        const sy = document.getElementById('sl_by'); if (sy) sy.value = snapY;
      }

      renderActiveExperimentGraphics();
    }
  });

  window.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      activeDragTarget = null;
      controls.enabled = true;
    }
  });
}

function showInspectHud(obj, clientX, clientY) {
  const hud = document.getElementById('inspectHud');
  const title = document.getElementById('inspectTargetName');
  const content = document.getElementById('inspectContent');

  let parentGroup = obj;
  while (parentGroup && !parentGroup.userData.name && parentGroup.parent) {
    parentGroup = parentGroup.parent;
  }

  const name = parentGroup.userData.name || '3D Object';
  title.innerText = name;
  content.innerHTML = `Position: (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})<br>Active Experiment: #${state.activeExpId}`;

  hud.style.left = `${Math.min(window.innerWidth - 220, clientX + 15)}px`;
  hud.style.top = `${Math.min(window.innerHeight - 150, clientY + 15)}px`;
  hud.style.display = 'block';
}

// ==========================================================================
// 15. DOM BINDINGS & KEYBOARD SHORTCUTS
// ==========================================================================
function setupUIEventListeners() {
  // Command Palette Trigger
  document.getElementById('btnCommandPalette').addEventListener('click', openCommandPalette);

  const paletteInput = document.getElementById('paletteSearchInput');
  paletteInput.addEventListener('input', (e) => filterPaletteCommands(e.target.value));
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteSelectedIndex = Math.min(paletteFilteredItems.length - 1, paletteSelectedIndex + 1);
      renderPaletteResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteSelectedIndex = Math.max(0, paletteSelectedIndex - 1);
      renderPaletteResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executePaletteItem(paletteSelectedIndex);
    } else if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // Focus Mode
  document.getElementById('btnFocusMode').addEventListener('click', toggleFocusMode);
  document.getElementById('btnExitFocus').addEventListener('click', toggleFocusMode);

  // View Mode Selector (SPACE / BOTH / MATH)
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.view));
  });
  document.getElementById('btnCloseMathHud').addEventListener('click', () => setViewMode('space'));

  // Camera Popover & Perspectives
  const camPopover = document.getElementById('cameraViewPopover');
  document.getElementById('btnCameraMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = camPopover.classList.contains('open');
    closeAllModals();
    if (!isOpen) camPopover.classList.add('open');
  });

  document.querySelectorAll('.menu-item-btn[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraPerspective(btn.dataset.cam));
  });

  // Audio Popover & Synthesizer
  const audioPopover = document.getElementById('audioPopover');
  document.getElementById('btnAudioMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = audioPopover.classList.contains('open');
    closeAllModals();
    if (!isOpen) audioPopover.classList.add('open');
  });

  document.getElementById('btnToggleAudioPlayback').addEventListener('click', toggleAudioPlayback);

  document.querySelectorAll('.track-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.track-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      audio.switchTrack(opt.dataset.track);
    });
  });

  document.getElementById('audioVolumeInput').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.setVolume(val);
    document.getElementById('val_audioVolume').innerText = `${Math.round(val * 100)}%`;
  });

  // Two-Grid Popover
  const gridPopover = document.getElementById('gridPopover');
  document.getElementById('btnGridMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = gridPopover.classList.contains('open');
    closeAllModals();
    if (!isOpen) gridPopover.classList.add('open');
  });

  document.querySelectorAll('.grid-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.grid-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.gridmode;
      state.gridMode = mode;
      state.showOriginalGrid = mode === 'both' || mode === 'orig';
      state.showTransformedGrid = mode === 'both' || mode === 'trans';
      document.getElementById('chkOriginalGrid').checked = state.showOriginalGrid;
      document.getElementById('chkTransformedGrid').checked = state.showTransformedGrid;
      baseGridGroup.visible = state.showOriginalGrid;
      renderActiveExperimentGraphics();
    });
  });

  document.getElementById('chkOriginalGrid').addEventListener('change', (e) => {
    state.showOriginalGrid = e.target.checked;
    baseGridGroup.visible = state.showOriginalGrid;
  });

  document.getElementById('chkTransformedGrid').addEventListener('change', (e) => {
    state.showTransformedGrid = e.target.checked;
    renderActiveExperimentGraphics();
  });

  document.getElementById('chkDropLines').addEventListener('change', (e) => {
    state.showDropLines = e.target.checked;
    renderActiveExperimentGraphics();
  });

  document.getElementById('chkTraceMode').addEventListener('change', (e) => {
    state.showTrace = e.target.checked;
    if (!state.showTrace) clearTrace();
  });

  document.getElementById('btnTransformationFlow').addEventListener('click', toggleFlowPlayback);

  // Flow scrub timeline slider
  document.getElementById('sl_flowProgress').addEventListener('input', (e) => {
    state.flowPlaying = false;
    document.getElementById('btnPlayFlow').innerText = '▶';
    setFlowProgress(parseFloat(e.target.value));
  });
  document.getElementById('btnPlayFlow').addEventListener('click', toggleFlowPlayback);

  // Inspector Mode Toggle
  document.getElementById('btnInspectMode').addEventListener('click', () => {
    state.inspectMode = !state.inspectMode;
    document.getElementById('btnInspectMode').classList.toggle('active', state.inspectMode);
    showToast(state.inspectMode ? '🔍 Inspect Mode: Click any 3D object' : 'Inspect Mode disabled');
  });
  document.getElementById('inspectCloseBtn').addEventListener('click', () => {
    document.getElementById('inspectHud').style.display = 'none';
  });

  // Explorer Modal
  document.getElementById('btnOpenExplorer').addEventListener('click', () => {
    closeAllModals();
    buildExplorerCardGrid();
    document.getElementById('explorerModal').classList.add('open');
  });
  document.getElementById('btnCloseExplorer').addEventListener('click', () => {
    document.getElementById('explorerModal').classList.remove('open');
  });
  document.getElementById('expIndicatorCard').addEventListener('click', () => {
    closeAllModals();
    buildExplorerCardGrid();
    document.getElementById('explorerModal').classList.add('open');
  });

  document.getElementById('explorerSearchInput').addEventListener('input', (e) => {
    buildExplorerCardGrid(e.target.value);
  });

  // Mathematical Info Modal
  document.getElementById('btnInfoModal').addEventListener('click', () => {
    closeAllModals();
    document.getElementById('infoModal').classList.add('open');
  });
  document.getElementById('btnCloseInfo').addEventListener('click', () => {
    document.getElementById('infoModal').classList.remove('open');
  });

  // Lab Notebook
  document.getElementById('btnOpenNotebook').addEventListener('click', () => {
    closeAllModals();
    renderNotebookModal();
    document.getElementById('notebookModal').classList.add('open');
  });
  document.getElementById('btnCloseNotebook').addEventListener('click', () => {
    document.getElementById('notebookModal').classList.remove('open');
  });
  document.getElementById('btnSaveObservation').addEventListener('click', () => saveCurrentObservation());
  document.getElementById('btnSaveCurrentState').addEventListener('click', () => {
    const input = document.getElementById('notebookNoteInput');
    saveCurrentObservation(input.value.trim());
    input.value = '';
  });

  // Settings Modal
  document.getElementById('btnSettingsModal').addEventListener('click', () => {
    closeAllModals();
    document.getElementById('settingsModal').classList.add('open');
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
  });

  document.getElementById('chkReducedMotion').addEventListener('change', (e) => {
    state.reducedMotion = e.target.checked;
  });
  document.getElementById('chkStarfield').addEventListener('change', (e) => {
    state.showStarfield = e.target.checked;
    starFieldGroup.visible = state.showStarfield;
  });
  document.getElementById('chkSfx').addEventListener('change', (e) => {
    state.enableSfx = e.target.checked;
  });
  document.getElementById('btnClearStorage').addEventListener('click', () => {
    localStorage.clear();
    showToast('Local storage cleared');
    renderNotebookModal();
  });

  // Share & Screenshot
  document.getElementById('btnShareLink').addEventListener('click', serializeStateToUrl);
  document.getElementById('btnCaptureScreenshot').addEventListener('click', captureCanvasScreenshot);

  // Mode Selectors (Explore, Guided, Challenge)
  document.getElementById('btnModeExplore').addEventListener('click', () => setAppMode('explore'));
  document.getElementById('btnModeGuided').addEventListener('click', () => setAppMode('guided'));
  document.getElementById('btnModeChallenge').addEventListener('click', () => setAppMode('challenge'));

  // Guided Stepper Navigation
  document.getElementById('btnGuidedPrev').addEventListener('click', () => {
    const prevId = state.activeExpId > 1 ? state.activeExpId - 1 : 17;
    switchExperiment(prevId);
  });
  document.getElementById('btnGuidedNext').addEventListener('click', () => {
    const nextId = state.activeExpId < 17 ? state.activeExpId + 1 : 1;
    switchExperiment(nextId);
  });

  // Contextual Panel Collapse Toggle
  document.getElementById('btnTogglePanelCollapse').addEventListener('click', () => {
    document.getElementById('contextualPanel').classList.toggle('collapsed');
  });
  document.getElementById('btnResetExpParams').addEventListener('click', () => {
    switchExperiment(state.activeExpId);
    showToast('↺ Parameters reset to default');
  });

  // Landing Page Overlay
  document.getElementById('btnEnterLab').addEventListener('click', () => {
    document.getElementById('landingOverlay').style.display = 'none';
    audio.start();
    document.getElementById('audioTrackStatus').innerText = 'Playing';
    document.getElementById('audioTrackStatus').style.color = 'var(--accent-emerald)';
    document.getElementById('btnToggleAudioPlayback').innerText = 'Pause Ambient Audio';
  });

  document.querySelectorAll('.domain-card').forEach(card => {
    card.addEventListener('click', () => {
      const domain = card.dataset.domain;
      document.getElementById('landingOverlay').style.display = 'none';
      if (domain === 'vectors') switchExperiment(1);
      else if (domain === 'transformations') switchExperiment(9);
      else if (domain === 'computation') switchExperiment(15);
      audio.start();
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    } else if (e.key === '/') {
      e.preventDefault();
      openCommandPalette();
    } else if (e.key.toLowerCase() === 'e') {
      document.getElementById('btnOpenExplorer').click();
    } else if (e.key.toLowerCase() === 'g') {
      document.getElementById('btnGridMenu').click();
    } else if (e.key.toLowerCase() === 'm') {
      toggleAudioPlayback();
    } else if (e.key.toLowerCase() === 'f') {
      toggleFocusMode();
    } else if (e.key.toLowerCase() === 'i') {
      document.getElementById('btnInfoModal').click();
    } else if (e.key.toLowerCase() === 'r') {
      setCameraPerspective('reset');
    } else if (e.key === 'Escape') {
      if (state.focusMode) toggleFocusMode();
      else closeAllModals();
    } else if (e.key === ' ') {
      e.preventDefault();
      toggleFlowPlayback();
    }
  });
}

function toggleAudioPlayback() {
  const isPlaying = audio.toggle();
  const statusEl = document.getElementById('audioTrackStatus');
  const btnEl = document.getElementById('btnToggleAudioPlayback');
  if (statusEl) {
    statusEl.innerText = isPlaying ? 'Playing' : 'Off';
    statusEl.style.color = isPlaying ? 'var(--accent-emerald)' : 'var(--accent-indigo)';
  }
  if (btnEl) {
    btnEl.innerText = isPlaying ? 'Pause Ambient Audio' : 'Start Ambient Audio';
  }
}

function buildExplorerCardGrid(searchQuery = '') {
  const container = document.getElementById('explorerCardGrid');
  if (!container) return;

  const q = searchQuery.toLowerCase().trim();
  const categories = ['FOUNDATIONS', 'TRANSFORMATIONS', 'COMPUTATION'];

  container.innerHTML = categories.map(cat => {
    const exps = Object.values(EXPERIMENTS).filter(e => e.category === cat && (!q || e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q)));
    return `
      <div>
        <div class="explorer-col-title">${cat}</div>
        <div>
          ${exps.map(exp => `
            <div class="explorer-row-item ${exp.id === state.activeExpId ? 'active' : ''}" onclick="switchExperiment(${exp.id})">
              <span class="explorer-item-num">${String(exp.id).padStart(2, '0')}</span>
              <span style="font-family:var(--font-mono); color:var(--accent-indigo-light); min-width:20px;">${exp.symbol||'↗'}</span>
              <span>${exp.title}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================================================
// 16. MAIN RAF SIMULATION & ANIMATION LOOP
// ==========================================================================
function animate(time) {
  requestAnimationFrame(animate);

  // Smooth camera perspective tweening
  if (cameraTween) {
    cameraTween.update(time);
  } else {
    controls.update();
  }

  // Smooth Transformation Flow Animation
  if (state.flowPlaying) {
    state.flowProgress += 0.008;
    if (state.flowProgress >= 1.0) {
      state.flowProgress = 1.0;
      state.flowPlaying = false;
      const btn = document.getElementById('btnPlayFlow');
      if (btn) btn.innerText = '▶';
    }
    setFlowProgress(state.flowProgress);
  }

  // Subtle Starfield Parallax Rotation
  if (starFieldGroup && state.showStarfield && !state.reducedMotion) {
    starFieldGroup.rotation.y = time * 0.00003;
    starFieldGroup.rotation.x = time * 0.000015;
  }

  renderer.render(scene, camera);
}

// ==========================================================================
// 17. APPLICATION INITIALIZATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  if (initScene()) {
    deserializeStateFromUrl();
    setupUIEventListeners();
    switchExperiment(state.activeExpId);
    animate(0);
  }
});
