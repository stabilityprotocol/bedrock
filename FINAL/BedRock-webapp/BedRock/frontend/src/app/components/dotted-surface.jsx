import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import * as THREE from 'three';

/**
 * DottedSurface — Two rendering options, controlled by USE_SHADER_MODE.
 *
 * ── OPTION 2 (default, USE_SHADER_MODE = true) ────────────────────────────
 *   Full GPU fluid simulation using ping-pong WebGLRenderTargets.
 *   The wave PDE (pressure / velocity / Laplacian) runs entirely on the GPU.
 *   The display pass renders a procedural dot grid displaced by the pressure
 *   field — visually identical to the original dots but with silky fluid physics.
 *
 * ── OPTION 1 (USE_SHADER_MODE = false) ────────────────────────────────────
 *   CPU-side pressure grid that propagates a wave equation across the particle
 *   array each frame. Particles are pushed by the pressure gradient rather than
 *   a direct distance check. Smoother than the old version; less smooth than
 *   the GPU path but easier to extend with per-dot logic.
 *
 * Props:
 *   melting   boolean — when true, dots fade out (click transition)
 *   dotColor  string  — hex color for dots
 *   opacity   number  — base opacity (0–1)
 *   mobile    boolean — reduced particle count / resolution on mobile
 *   mouseRef  ref     — { nx, ny } NDC mouse coords from parent
 */

// ─── Toggle ──────────────────────────────────────────────────────────────────
const USE_SHADER_MODE = true;   // true = Option 2 (GPU shader), false = Option 1 (CPU)

// ─── Shared tunables ─────────────────────────────────────────────────────────
const DOT_COLOR_HEX  = '#8B78C1'; // fallback — overridden by dotColor prop
const DOT_SPACING    = 28;        // Option 2: pixels between dot centres at sim resolution
const WAVE_SPEED     = 0.9;
const WAVE_DAMPING   = 0.72;
const RIPPLE_SIZE    = 5;
const MOUSE_FORCE    = 0.35;

// Option 1 only
const SPRING_STIFFNESS   = 0.002;
const DAMPING_1          = 0.945; // lower friction → snappier acceleration
const REPULSION_STRENGTH = 28;
const MOUSE_RADIUS_1     = 220;
const WAKE_SPEED_SCALE   = 0.5;
// ─────────────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════
//  OPTION 2 — Hybrid: GPU fluid sim → CPU reads pressure → 3D Points mesh
//
//  The wave PDE runs on the GPU in a small ping-pong render target.
//  Each frame we readPixels() a tiny pressure-only buffer back to the CPU,
//  then use those pressure + gradient values to drive XZ forces on the same
//  3D Points mesh from Option 1 — preserving the perspective horizon view.
// ═══════════════════════════════════════════════════════════════════════════

function mountShaderMode(container, meltingRef, dotColorHex, opacityTarget, mobile, mouseRef) {
  // ── Grid config (same as Option 1) ────────────────────────────────────────
  const SEPARATION = mobile ? 120 : 110;
  const AMOUNTX    = mobile ? 22  : 40;
  const AMOUNTY    = mobile ? 32  : 60;
  const TOTAL      = AMOUNTX * AMOUNTY;

  const w = container.offsetWidth  || window.innerWidth;
  const h = container.offsetHeight || 260;

  // ── Sim resolution: one texel per grid cell ────────────────────────────────
  // We size the render target exactly to the particle grid so each readPixel
  // maps 1:1 to a particle — no interpolation needed.
  const SIM_W = AMOUNTX;
  const SIM_H = AMOUNTY;

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const isWebGL2 = renderer.capabilities?.isWebGL2 ?? false;
  // Use FloatType when available — HalfFloat loses precision in pressure values
  const rtType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;

  const rtOpts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format:    THREE.RGBAFormat,
    type:      rtType,
  };
  let rtA = new THREE.WebGLRenderTarget(SIM_W, SIM_H, rtOpts);
  let rtB = rtA.clone();

  // ── Off-screen quad (for sim passes only) ─────────────────────────────────
  const simScene  = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad      = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  simScene.add(quad);

  // ── Simulation shader (wave PDE — identical to original reference) ─────────
  const simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTexture:    { value: null },
      uResolution: { value: new THREE.Vector2(SIM_W, SIM_H) },
      uMouse:      { value: new THREE.Vector3(-1, -1, 0) }, // .xy = sim texel, .z = active
      uDelta:      { value: WAVE_SPEED },
      uDamping:    { value: WAVE_DAMPING },
      uRippleSize: { value: RIPPLE_SIZE },
      uForce:      { value: MOUSE_FORCE },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uTexture;
      uniform vec2      uResolution;
      uniform vec3      uMouse;
      uniform float     uDelta;
      uniform float     uDamping;
      uniform float     uRippleSize;
      uniform float     uForce;
      varying vec2 vUv;

      void main() {
        vec2 texel = 1.0 / uResolution;
        vec2 coord = vUv;

        vec4  data     = texture2D(uTexture, coord);
        float pressure = data.x;
        float velocity = data.y;

        float pR  = texture2D(uTexture, coord + vec2( texel.x,      0.0)).x;
        float pL  = texture2D(uTexture, coord + vec2(-texel.x,      0.0)).x;
        float pU  = texture2D(uTexture, coord + vec2( 0.0,      texel.y)).x;
        float pD  = texture2D(uTexture, coord + vec2( 0.0,     -texel.y)).x;
        float pTR = texture2D(uTexture, coord + vec2( texel.x,  texel.y)).x;
        float pTL = texture2D(uTexture, coord + vec2(-texel.x,  texel.y)).x;
        float pBR = texture2D(uTexture, coord + vec2( texel.x, -texel.y)).x;
        float pBL = texture2D(uTexture, coord + vec2(-texel.x, -texel.y)).x;

        if (coord.x < texel.x)        pL = pR;
        if (coord.x > 1.0 - texel.x)  pR = pL;
        if (coord.y < texel.y)        pD = pU;
        if (coord.y > 1.0 - texel.y)  pU = pD;

        float laplacian = (pR + pL + pU + pD) * 0.20
                        + (pTR + pTL + pBR + pBL) * 0.05
                        - pressure;

        velocity += uDelta * laplacian * 2.0;
        pressure += uDelta * velocity;
        pressure  = mix(pressure, (pR + pL + pU + pD) * 0.25, 0.04);
        velocity -= 0.002 * uDelta * pressure;
        velocity *= 1.0 - 0.01 * uDelta;
        pressure *= uDamping;

        if (uMouse.z > 0.5) {
          float dist  = distance(coord * uResolution, uMouse.xy);
          float force = exp(-dist * dist / (uRippleSize * uRippleSize * 0.5));
          pressure += force * uForce;
        }

        pressure = clamp(pressure, -2.0, 2.0);
        velocity = clamp(velocity, -2.0, 2.0);

        float gradX = (pR - pL) * 0.5;
        float gradY = (pU - pD) * 0.5;

        gl_FragColor = vec4(pressure, velocity, gradX, gradY);
      }
    `,
  });

  // ── Readback buffer (RGBA floats, one entry per grid cell) ─────────────────
  // We read the sim target back every frame to extract pressure/gradient per cell.
  const readBuffer = new Float32Array(SIM_W * SIM_H * 4);

  // ── 3D scene: perspective camera + Points mesh (identical to Option 1) ─────
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
  camera.position.set(0, 160, 480);
  camera.updateProjectionMatrix();

  // Ray-plane intersection helper (maps NDC cursor → world XZ at Y=0)
  function screenToWorld(nx, ny) {
    const ray = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = ray.sub(camera.position).normalize();
    if (Math.abs(dir.y) < 0.001) return null;
    const t = -camera.position.y / dir.y;
    return { x: camera.position.x + dir.x * t, z: camera.position.z + dir.z * t };
  }

  // Cursor state (world-space, for mouse injection into sim)
  const cursor = { wx: 0, wz: 0, active: false };
  const smooth = { wx: 0, wz: 0, prevWx: 0, prevWz: 0 };
  const mouseVel = { vx: 0, vz: 0 };
  let influence = 0;
  let wavePhase = 0;

  const PZ_MAX = (AMOUNTY * SEPARATION) / 2;
  const PZ_MIN = -(AMOUNTY * SEPARATION) / 2;

  // ── Particle state arrays ──────────────────────────────────────────────────
  const anchorX = new Float32Array(TOTAL);
  const anchorZ = new Float32Array(TOTAL);
  const dispX   = new Float32Array(TOTAL);
  const dispZ   = new Float32Array(TOTAL);
  const velX    = new Float32Array(TOTAL);
  const velZ    = new Float32Array(TOTAL);

  const positions = new Float32Array(TOTAL * 3);

  // Particles indexed as [ix * AMOUNTY + iy]
  // In the sim texture, column = ix (U), row = iy (V)
  let idx = 0;
  for (let ix = 0; ix < AMOUNTX; ix++) {
    for (let iy = 0; iy < AMOUNTY; iy++) {
      const ax = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
      const az = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
      anchorX[idx] = ax;
      anchorZ[idx] = az;
      positions[idx * 3]     = ax;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = az;
      idx++;
    }
  }

  // ── Sprite texture (512px sharp circle — crisp at any screen size) ─────────
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = spriteCanvas.height = 512;
  const sc = spriteCanvas.getContext('2d');
  // Sharp circle with 2px antialiasing feather only — no wide soft halo
  const grad = sc.createRadialGradient(256, 256, 246, 256, 256, 256);
  grad.addColorStop(0,   'rgba(255,255,255,1.0)');
  grad.addColorStop(1,   'rgba(255,255,255,0.0)');
  sc.fillStyle = grad;
  sc.fillRect(0, 0, 512, 512);
  const circleTexture = new THREE.CanvasTexture(spriteCanvas);
  circleTexture.generateMipmaps = true;
  circleTexture.minFilter = THREE.LinearMipmapLinearFilter;
  circleTexture.magFilter = THREE.LinearFilter;

  const geometry = new THREE.BufferGeometry();
  const posAttr  = new THREE.Float32BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posAttr);

  const dotColor3 = new THREE.Color(dotColorHex);
  const material  = new THREE.PointsMaterial({
    size: mobile ? 12 : 20,
    color: dotColor3,
    map: circleTexture,
    alphaTest: 0.05,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let count          = 0;
  let animId;
  let currentOpacity = 0;
  const finalOpacity = opacityTarget * 0.8;

  // ── Animation loop ─────────────────────────────────────────────────────────
  const animate = () => {
    animId = requestAnimationFrame(animate);

    // Opacity fade
    const opTarget = meltingRef.current ? 0 : finalOpacity;
    currentOpacity += (opTarget - currentOpacity) * 0.04;
    material.opacity = currentOpacity;

    // ── Cursor world position — only active when inside the canvas bounds ────
    if (mouseRef?.current) {
      const rect   = renderer.domElement.getBoundingClientRect();
      const heroNx = mouseRef.current.nx;
      const heroNy = mouseRef.current.ny;
      const parentEl   = container.parentElement;
      const parentRect = parentEl ? parentEl.getBoundingClientRect() : rect;
      const clientX = (heroNx + 1) * 0.5 * parentRect.width  + parentRect.left;
      const clientY = (1 - (heroNy + 1) * 0.5) * parentRect.height + parentRect.top;
      const inside  = clientX >= rect.left && clientX <= rect.right &&
                      clientY >= rect.top  && clientY <= rect.bottom;
      if (inside) {
        const world = screenToWorld(heroNx, heroNy);
        if (world) { cursor.wx = world.x; cursor.wz = world.z; cursor.active = true; }
      } else {
        cursor.active = false;
      }
    } else {
      cursor.active = false;
    }

    if (cursor.active) {
      smooth.prevWx = smooth.wx;
      smooth.prevWz = smooth.wz;
      smooth.wx += (cursor.wx - smooth.wx) * 0.08;
      smooth.wz += (cursor.wz - smooth.wz) * 0.08;
      mouseVel.vx = smooth.wx - smooth.prevWx;
      mouseVel.vz = smooth.wz - smooth.prevWz;
    } else {
      mouseVel.vx = 0; mouseVel.vz = 0;
    }
    influence += ((cursor.active ? 1 : 0) - influence) * 0.04;
    wavePhase += 0.028;

    // ── Map world cursor → sim texel coords ───────────────────────────────
    // anchorX ranges from -(AMOUNTX*SEP)/2 to +(AMOUNTX*SEP)/2
    // → normalise to 0..1, then scale to SIM_W / SIM_H
    const worldW = AMOUNTX * SEPARATION;
    const worldD = AMOUNTY * SEPARATION;
    const simMouseX = ((smooth.wx + worldW * 0.5) / worldW) * SIM_W;
    // Z axis: negative Z = front of grid (iy=0), positive Z = back (iy=AMOUNTY-1)
    // In the sim texture V=0 is bottom (iy=0), V=1 is top (iy=AMOUNTY-1).
    const simMouseY = ((smooth.wz + worldD * 0.5) / worldD) * SIM_H;

    simMaterial.uniforms.uMouse.value.set(
      simMouseX,
      simMouseY,
      cursor.active ? 1.0 : 0.0
    );

    // ── GPU sim pass ───────────────────────────────────────────────────────
    simMaterial.uniforms.uTexture.value = rtA.texture;
    quad.material = simMaterial;
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, simCamera);
    [rtA, rtB] = [rtB, rtA];

    // ── Read pressure field back to CPU ───────────────────────────────────
    renderer.readRenderTargetPixels(rtA, 0, 0, SIM_W, SIM_H, readBuffer);

    // ── Per-particle: apply pressure gradient as XZ force ─────────────────
    const arr = posAttr.array;

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const i = ix * AMOUNTY + iy;

        // Sim texture is stored row-major: pixel at (ix, iy) → index (iy * SIM_W + ix)
        // readBuffer layout: [R,G,B,A, R,G,B,A, ...]
        // R = pressure, G = velocity, B = gradX, A = gradY
        const texIdx  = (iy * SIM_W + ix) * 4;
        const gradX   = readBuffer[texIdx + 2]; // dP/dX in grid space
        const gradZ   = readBuffer[texIdx + 3]; // dP/dY in grid space (maps to world Z)

        // Scale: sim gradient is in "per texel" units, convert to world force
        const forceScale = SEPARATION * 0.05;
        velX[i] += gradX * forceScale;
        velZ[i] += gradZ * forceScale;

        // Spring back to anchor
        velX[i] += (0 - dispX[i]) * SPRING_STIFFNESS;
        velZ[i] += (0 - dispZ[i]) * SPRING_STIFFNESS;

        // Damping
        velX[i] *= DAMPING_1;
        velZ[i] *= DAMPING_1;

        dispX[i] += velX[i];
        dispZ[i] += velZ[i];

        const ax = anchorX[i];
        const az = anchorZ[i];

        // Background sine wave (identical to original)
        const baseY =
          Math.sin((ix + count) * 0.3) * 28 +
          Math.sin((iy + count) * 0.5) * 28;

        // Decorative Y ripple driven by pressure magnitude
        const pressure = readBuffer[texIdx]; // R channel
        const depthT    = (az - PZ_MIN) / (PZ_MAX - PZ_MIN);
        const depthScale = depthT * 0.8 + 0.2;
        const waterY    = pressure * 5 * depthScale * influence;

        arr[i * 3]     = ax + dispX[i];
        arr[i * 3 + 1] = baseY + waterY;
        arr[i * 3 + 2] = az + dispZ[i];
      }
    }

    posAttr.needsUpdate = true;

    // ── 3D display pass ────────────────────────────────────────────────────
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    count += 0.05;
  };

  animate();

  const handleResize = () => {
    if (!container) return;
    const nw = container.offsetWidth;
    const nh = container.offsetHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  };
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    cancelAnimationFrame(animId);
    rtA.dispose();
    rtB.dispose();
    simMaterial.dispose();
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}


// ═══════════════════════════════════════════════════════════════════════════
//  OPTION 1 — CPU pressure-grid particle physics
// ═══════════════════════════════════════════════════════════════════════════

function mountParticleMode(container, meltingRef, dotColorHex, opacityTarget, mobile, mouseRef) {
  const SEPARATION = mobile ? 120 : 110;
  const AMOUNTX    = mobile ? 22  : 40;
  const AMOUNTY    = mobile ? 32  : 60;
  const TOTAL      = AMOUNTX * AMOUNTY;

  const w = container.offsetWidth  || window.innerWidth;
  const h = container.offsetHeight || 260;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
  camera.position.set(0, 160, 480);
  camera.updateProjectionMatrix();

  function screenToWorld(nx, ny) {
    const ray = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = ray.sub(camera.position).normalize();
    if (Math.abs(dir.y) < 0.001) return null;
    const t = -camera.position.y / dir.y;
    return { x: camera.position.x + dir.x * t, z: camera.position.z + dir.z * t };
  }

  const cursor = { wx: 0, wz: 0, active: false };
  const smooth = { wx: 0, wz: 0, prevWx: 0, prevWz: 0 };
  const mouseVel = { vx: 0, vz: 0 };
  let influence = 0;
  let wavePhase = 0;

  const PZ_MAX = (AMOUNTY * SEPARATION) / 2;
  const PZ_MIN = -(AMOUNTY * SEPARATION) / 2;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // ── Particle state ────────────────────────────────────────────────────────
  const anchorX = new Float32Array(TOTAL);
  const anchorZ = new Float32Array(TOTAL);
  const dispX   = new Float32Array(TOTAL);
  const dispZ   = new Float32Array(TOTAL);
  const velX    = new Float32Array(TOTAL);
  const velZ    = new Float32Array(TOTAL);

  // ── Pressure field (same grid dimensions as particles) ────────────────────
  // pressure[ix][iy] stored as pressure[ix * AMOUNTY + iy]
  const pressure  = new Float32Array(TOTAL);
  const pressureV = new Float32Array(TOTAL); // pressure velocity
  const pressureN = new Float32Array(TOTAL); // next frame buffer

  const positions = new Float32Array(TOTAL * 3);

  let idx = 0;
  for (let ix = 0; ix < AMOUNTX; ix++) {
    for (let iy = 0; iy < AMOUNTY; iy++) {
      const ax = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
      const az = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
      anchorX[idx] = ax;
      anchorZ[idx] = az;
      positions[idx * 3]     = ax;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = az;
      idx++;
    }
  }

  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = spriteCanvas.height = 512;
  const sc = spriteCanvas.getContext('2d');
  const grad1 = sc.createRadialGradient(256, 256, 246, 256, 256, 256);
  grad1.addColorStop(0,   'rgba(255,255,255,1.0)');
  grad1.addColorStop(1,   'rgba(255,255,255,0.0)');
  sc.fillStyle = grad1;
  sc.fillRect(0, 0, 512, 512);
  const circleTexture = new THREE.CanvasTexture(spriteCanvas);
  circleTexture.generateMipmaps = true;
  circleTexture.minFilter = THREE.LinearMipmapLinearFilter;
  circleTexture.magFilter = THREE.LinearFilter;

  const geometry = new THREE.BufferGeometry();
  const posAttr  = new THREE.Float32BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posAttr);

  const color    = new THREE.Color(dotColorHex);
  const material = new THREE.PointsMaterial({
    size: mobile ? 12 : 20,
    color,
    map: circleTexture,
    alphaTest: 0.05,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let count          = 0;
  let animId;
  let currentOpacity = 0;
  const finalOpacity = opacityTarget * 0.8;

  const animate = () => {
    animId = requestAnimationFrame(animate);

    // Opacity
    const opTarget = meltingRef.current ? 0 : finalOpacity;
    currentOpacity += (opTarget - currentOpacity) * 0.04;
    material.opacity = currentOpacity;

    // Mouse world position — only active when inside the canvas bounds
    if (mouseRef?.current) {
      const rect   = renderer.domElement.getBoundingClientRect();
      const heroNx = mouseRef.current.nx;
      const heroNy = mouseRef.current.ny;
      const parentEl   = container.parentElement;
      const parentRect = parentEl ? parentEl.getBoundingClientRect() : rect;
      const clientX = (heroNx + 1) * 0.5 * parentRect.width  + parentRect.left;
      const clientY = (1 - (heroNy + 1) * 0.5) * parentRect.height + parentRect.top;
      const inside  = clientX >= rect.left && clientX <= rect.right &&
                      clientY >= rect.top  && clientY <= rect.bottom;
      if (inside) {
        const world = screenToWorld(heroNx, heroNy);
        if (world) { cursor.wx = world.x; cursor.wz = world.z; cursor.active = true; }
      } else {
        cursor.active = false;
      }
    } else {
      cursor.active = false;
    }

    if (cursor.active) {
      smooth.prevWx = smooth.wx;
      smooth.prevWz = smooth.wz;
      smooth.wx += (cursor.wx - smooth.wx) * 0.08;
      smooth.wz += (cursor.wz - smooth.wz) * 0.08;
      mouseVel.vx = smooth.wx - smooth.prevWx;
      mouseVel.vz = smooth.wz - smooth.prevWz;
    } else {
      mouseVel.vx = 0; mouseVel.vz = 0;
    }

    const targetInfluence = cursor.active ? 1 : 0;
    influence += (targetInfluence - influence) * 0.04;

    wavePhase += 0.028;

    // ── Pressure field update (wave PDE on CPU grid) ──────────────────────
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const i = ix * AMOUNTY + iy;

        // Neighbour indices (clamp to edges = reflect boundary)
        const iL  = (ix > 0              ? (ix - 1) : ix)     * AMOUNTY + iy;
        const iR  = (ix < AMOUNTX - 1    ? (ix + 1) : ix)     * AMOUNTY + iy;
        const iU  = ix * AMOUNTY + (iy < AMOUNTY - 1 ? iy + 1 : iy);
        const iD  = ix * AMOUNTY + (iy > 0           ? iy - 1 : iy);

        // Diagonal neighbours (for 8-tap Laplacian)
        const ixL = ix > 0 ? ix - 1 : ix;
        const ixR = ix < AMOUNTX - 1 ? ix + 1 : ix;
        const iyU = iy < AMOUNTY - 1 ? iy + 1 : iy;
        const iyD = iy > 0 ? iy - 1 : iy;
        const iTR = ixR * AMOUNTY + iyU;
        const iTL = ixL * AMOUNTY + iyU;
        const iBR = ixR * AMOUNTY + iyD;
        const iBL = ixL * AMOUNTY + iyD;

        const laplacian =
          (pressure[iR] + pressure[iL] + pressure[iU] + pressure[iD]) * 0.20 +
          (pressure[iTR] + pressure[iTL] + pressure[iBR] + pressure[iBL]) * 0.05 -
          pressure[i];

        pressureV[i] += WAVE_SPEED * laplacian * 2.0;
        pressureN[i]  = pressure[i] + WAVE_SPEED * pressureV[i];

        // Viscosity
        pressureN[i] = pressureN[i] * 0.96 +
          (pressure[iR] + pressure[iL] + pressure[iU] + pressure[iD]) * 0.01;

        pressureV[i] -= 0.002 * WAVE_SPEED * pressure[i];
        pressureV[i] *= (1.0 - 0.01 * WAVE_SPEED);
        pressureN[i] *= WAVE_DAMPING;

        // Mouse injection into pressure field
        if (influence > 0.01) {
          const ax  = anchorX[i];
          const az  = anchorZ[i];
          const dx  = ax - smooth.wx;
          const dz  = az - smooth.wz;
          const d2  = dx * dx + dz * dz;
          const d   = Math.sqrt(d2) + 0.001;
          if (d < MOUSE_RADIUS_1) {
            const speed     = Math.sqrt(mouseVel.vx * mouseVel.vx + mouseVel.vz * mouseVel.vz);
            const wakeBoost = 1 + speed * WAKE_SPEED_SCALE;
            const falloff   = 0.5 * (1 + Math.cos(Math.PI * d / MOUSE_RADIUS_1));
            pressureN[i] += falloff * REPULSION_STRENGTH * 0.12 * wakeBoost * influence;
          }
        }

        pressureN[i] = Math.max(-2, Math.min(2, pressureN[i]));
      }
    }

    // Copy pressureN → pressure
    pressure.set(pressureN);

    // ── Per-particle: read pressure gradient, apply as force ─────────────
    const arr = posAttr.array;

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const i = ix * AMOUNTY + iy;

        const iL = (ix > 0           ? ix - 1 : ix) * AMOUNTY + iy;
        const iR = (ix < AMOUNTX - 1 ? ix + 1 : ix) * AMOUNTY + iy;
        const iU = ix * AMOUNTY + (iy < AMOUNTY - 1 ? iy + 1 : iy);
        const iD = ix * AMOUNTY + (iy > 0           ? iy - 1 : iy);

        // Pressure gradient = direction of force on particle
        const gradX = (pressure[iR] - pressure[iL]) * 0.5;
        const gradZ = (pressure[iU] - pressure[iD]) * 0.5;

        // Apply gradient as force (repulsion = pushed away from high pressure)
        velX[i] += gradX * MOUSE_RADIUS_1 * 0.15;
        velZ[i] += gradZ * MOUSE_RADIUS_1 * 0.15;

        // Spring back to anchor
        velX[i] += (0 - dispX[i]) * SPRING_STIFFNESS;
        velZ[i] += (0 - dispZ[i]) * SPRING_STIFFNESS;

        // Damping
        velX[i] *= DAMPING_1;
        velZ[i] *= DAMPING_1;

        dispX[i] += velX[i];
        dispZ[i] += velZ[i];

        const ax = anchorX[i];
        const az = anchorZ[i];

        const baseY =
          Math.sin((ix + count) * 0.3) * 28 +
          Math.sin((iy + count) * 0.5) * 28;

        let waterY = 0;
        if (influence > 0.01) {
          const depthT    = (az - PZ_MIN) / (PZ_MAX - PZ_MIN);
          const depthScale = depthT * 0.8 + 0.2;
          const rdx = ax + dispX[i] - smooth.wx;
          const rdz = az + dispZ[i] - smooth.wz;
          const rd  = Math.sqrt(rdx * rdx + rdz * rdz);
          waterY    = 22 * influence * depthScale
                    * Math.exp(-rd * rd / (2500 * 2500))
                    * Math.sin(rd * 0.004 - wavePhase);
        }

        arr[i * 3]     = ax + dispX[i];
        arr[i * 3 + 1] = baseY + waterY;
        arr[i * 3 + 2] = az + dispZ[i];
      }
    }

    posAttr.needsUpdate = true;
    renderer.render(scene, camera);
    count += 0.05;
  };

  animate();

  const handleResize = () => {
    if (!container) return;
    const nw = container.offsetWidth;
    const nh = container.offsetHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  };
  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    cancelAnimationFrame(animId);
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}


// ═══════════════════════════════════════════════════════════════════════════
//  React component
// ═══════════════════════════════════════════════════════════════════════════

export function DottedSurface({
  melting  = false,
  dotColor = DOT_COLOR_HEX,
  opacity  = 1,
  mobile   = false,
  mouseRef = null,
}) {
  const containerRef = useRef(null);
  const meltingRef   = useRef(melting);

  useEffect(() => { meltingRef.current = melting; }, [melting]);

  useEffect(() => {
    if (!containerRef.current) return;

    const cleanup = USE_SHADER_MODE
      ? mountShaderMode(containerRef.current, meltingRef, dotColor, opacity, mobile, mouseRef)
      : mountParticleMode(containerRef.current, meltingRef, dotColor, opacity, mobile, mouseRef);

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: { xs: '30vh', md: '32vh' },
        pointerEvents: 'none',
        zIndex: 1,
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 100%)',
      }}
    />
  );
}
