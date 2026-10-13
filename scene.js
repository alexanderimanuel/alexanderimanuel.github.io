import * as THREE from './vendor/three.module.js';

// One bust surface (Tripo reconstruction from Alex's studio portrait). Colour is
// view-dependent: the studio photograph is projected from its fitted camera at frontal
// angles and fades into the bust's own atlas (which carries the photograph's skin
// detail) as the head turns. Only the object rotates; every map stays unchanged.
export async function initScene({ canvas, onReady, onAngleChange } = {}) {
  if (!canvas) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    console.warn('The portrait could not start.', error);
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const resources = new Set();
  const keep = value => { resources.add(value); return value; };
  const release = () => { for (const resource of resources) resource.dispose(); resources.clear(); renderer.dispose(); };
  const loadBitmap = async (src, color) => {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`A portrait asset is unavailable: ${src}`);
    const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const texture = keep(new THREE.Texture(bitmap));
    texture.addEventListener('dispose', () => bitmap.close());
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.flipY = false;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = color;
    texture.minFilter = color ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = color ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    texture.needsUpdate = true;
    return texture;
  };
  let description, geometry, atlas, weightTextures, photoTextures, flowTextures;
  try {
    const response = await fetch('./assets/head-static.json');
    if (!response.ok) throw new Error('The portrait model is unavailable.');
    description = await response.json();
    const count = description.vertexCount, indexCount = description.indexCount, views = description.views;
    if (!Number.isInteger(count) || count < 100 || !Number.isInteger(indexCount) || indexCount % 3 || description.vertexStride !== 8) throw new Error('The portrait model is invalid.');
    if (!Array.isArray(views) || views.length < 1 || views.length > 6 || !Array.isArray(description.viewWeights) || description.viewWeights.length < 1) throw new Error('The portrait views are invalid.');
    const [binary, atlasTexture, weightA, weightB, ...maps] = await Promise.all([
      fetch(`./assets/${description.binary}`).then(async item => { if (!item.ok) throw new Error('The portrait surface could not load.'); return item.arrayBuffer(); }),
      loadBitmap(`./assets/${description.texture}`, true),
      loadBitmap(`./assets/${description.viewWeights[0]}`, false),
      description.viewWeights[1] ? loadBitmap(`./assets/${description.viewWeights[1]}`, false) : null,
      ...views.map(view => loadBitmap(`./assets/${view.src}`, true)),
      ...views.map(view => view.flow ? loadBitmap(`./assets/${view.flow}`, false) : null),
    ]);
    atlas = atlasTexture; weightTextures = [weightA, weightB || weightA]; photoTextures = maps.slice(0, views.length); flowTextures = maps.slice(views.length);
    if (binary.byteLength !== count * 32 + indexCount * 4) throw new Error('The portrait surface is incomplete.');
    const vertices = new Float32Array(binary, 0, count * 8), indices = new Uint32Array(binary, count * 32, indexCount);
    if (vertices.some(value => !Number.isFinite(value)) || indices.some(value => value >= count)) throw new Error('The portrait surface is invalid.');
    geometry = keep(new THREE.BufferGeometry());
    const attributes = new THREE.InterleavedBuffer(vertices, 8);
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(attributes, 3, 0));
    geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(attributes, 3, 3));
    geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(attributes, 2, 6));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  } catch (error) {
    release(); console.warn('The portrait could not load.', error); return null;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-7, 7, 3.94, -3.94, .1, 60);
  camera.position.set(0, 0, 18);
  const portrait = new THREE.Group();
  scene.add(portrait);
  const box = geometry.boundingBox;
  const fade = description.neckFade || [box.min.y - 1, box.min.y - .5];
  const views = description.views;
  const channels = ['r', 'g', 'b', 'a'];
  const viewParams = views.map(view => {
    const radians = THREE.MathUtils.degToRad(view.yaw);
    return new THREE.Vector4(Math.cos(radians), Math.sin(radians), view.scale, 0);
  });
  const viewOffset = views.map(view => new THREE.Vector2(view.offset[0], view.offset[1]));
  const viewBlend = views.map(() => 0);
  const viewMorph = views.map(() => new THREE.Vector2(0, 0));
  // Each photograph fades out between its fade angles, or linearly toward its neighbours.
  const sortedYaws = views.map(view => THREE.MathUtils.euclideanModulo(view.yaw, 360)).sort((a, b) => a - b);
  const gaps = views.map(view => {
    const yaw = THREE.MathUtils.euclideanModulo(view.yaw, 360), index = sortedYaws.indexOf(yaw);
    const previous = sortedYaws[(index + sortedYaws.length - 1) % sortedYaws.length], next = sortedYaws[(index + 1) % sortedYaws.length];
    return [THREE.MathUtils.euclideanModulo(yaw - previous, 360) || 360, THREE.MathUtils.euclideanModulo(next - yaw, 360) || 360];
  });
  function updateBlend(angle) {
    views.forEach((view, index) => {
      const delta = THREE.MathUtils.euclideanModulo(angle - view.yaw + 180, 360) - 180;
      if (view.fade) viewBlend[index] = 1 - THREE.MathUtils.smoothstep(Math.abs(delta), view.fade[0], view.fade[1]);
      else viewBlend[index] = delta < 0 ? Math.max(0, 1 + delta / gaps[index][0]) : Math.max(0, 1 - delta / gaps[index][1]);
      viewMorph[index].set(delta < 0 ? Math.min(1, -delta / gaps[index][0]) : 0, delta > 0 ? Math.min(1, delta / gaps[index][1]) : 0);
    });
  }
  const viewMacro = (index, photo, flow, map, channel) => `
        {
          float blend = viewBlend[${index}];
          if (blend > 0.0) {
            float visibility = texture2D(${map}, vPortraitUv).${channel};
            if (visibility > 0.004) {
              vec4 cam = viewParams[${index}];
              vec2 pixel = viewOffset[${index}] + cam.z * vec2(cam.x * vObject.x + cam.y * vObject.z, -vObject.y);
              vec2 photoUv = vec2(pixel.x / viewSize, 1.0 - pixel.y / viewSize);
              ${flow ? `vec4 slide = (texture2D(${flow}, photoUv) * 2.0 - 1.0) * flowRange;
              vec2 shift = viewMorph[${index}].x * slide.xy + viewMorph[${index}].y * slide.zw;
              photoUv += vec2(shift.x, -shift.y) / viewSize;` : ''}
              if (photoUv.x > 0.0 && photoUv.x < 1.0 && photoUv.y > 0.0 && photoUv.y < 1.0) {
                vec4 tap = texture2D(${photo}, photoUv);
                float weight = blend * smoothstep(0.06, 0.35, visibility) * visibility * tap.a;
                accumulated += weight * tap.rgb;
                total += weight;
              }
            }
          }
        }`;
  const material = keep(new THREE.ShaderMaterial({
    uniforms: {
      portraitAtlas: { value: atlas }, neckFade: { value: new THREE.Vector2(...fade) },
      modelScale: { value: description.modelScale || 1 }, viewSize: { value: description.viewSize || 1024 },
      weightA: { value: weightTextures[0] }, weightB: { value: weightTextures[1] },
      ...Object.fromEntries(views.flatMap((view, index) => [[`photo${index}`, { value: photoTextures[index] }], ...(flowTextures[index] ? [[`flow${index}`, { value: flowTextures[index] }]] : [])])),
      flowRange: { value: description.flowRange || 64 }, fallbackWeight: { value: description.fallbackWeight ?? 0.06 },
      viewParams: { value: viewParams }, viewOffset: { value: viewOffset }, viewBlend: { value: viewBlend }, viewMorph: { value: viewMorph },
    },
    transparent: true, depthWrite: true, side: THREE.FrontSide,
    vertexShader: `
      uniform float modelScale;
      varying vec2 vPortraitUv;
      varying vec3 vObject;
      varying vec3 vViewNormal;
      varying float vHeadHeight;
      void main() {
        vPortraitUv = uv;
        vObject = position / modelScale;
        vViewNormal = normalMatrix * normal;
        vHeadHeight = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <common>
      uniform sampler2D portraitAtlas;
      uniform sampler2D weightA;
      uniform sampler2D weightB;
      ${views.map((view, index) => `uniform sampler2D photo${index};${flowTextures[index] ? ` uniform sampler2D flow${index};` : ''}`).join('\n      ')}
      uniform vec4 viewParams[${views.length}];
      uniform vec2 viewOffset[${views.length}];
      uniform float viewBlend[${views.length}];
      uniform vec2 viewMorph[${views.length}];
      uniform float viewSize;
      uniform float flowRange;
      uniform float fallbackWeight;
      uniform vec2 neckFade;
      varying vec2 vPortraitUv;
      varying vec3 vObject;
      varying vec3 vViewNormal;
      varying float vHeadHeight;
      void main() {
        vec3 accumulated = vec3(0.0);
        float total = 0.0;
        ${views.map((view, index) => viewMacro(index, `photo${index}`, flowTextures[index] ? `flow${index}` : null, view.weightTexture ? 'weightB' : 'weightA', channels[view.weightChannel])).join('')}
        vec4 fallback = texture2D(portraitAtlas, vPortraitUv);
        accumulated += fallbackWeight * fallback.rgb;
        total += fallbackWeight;
        vec4 photographicColor = vec4(accumulated / total, 1.0);
        // gentle fixed studio light so the head reads as a volume while it turns
        float lambert = max(dot(normalize(vViewNormal), normalize(vec3(0.35, 0.45, 0.82))), 0.0);
        photographicColor.rgb *= 0.78 + 0.26 * lambert;
        photographicColor.a *= smoothstep(neckFade.x, neckFade.y, vHeadHeight);
        if (photographicColor.a < 0.008) discard;
        gl_FragColor = photographicColor;
        #include <colorspace_fragment>
      }
    `,
  }));
  const mesh = new THREE.Mesh(geometry, material);
  portrait.add(mesh);
  const baseQuaternion = new THREE.Quaternion();
  const rotation = description.frontCamera?.rotation;
  if (rotation?.length === 3) {
    const matrix = new THREE.Matrix4().set(rotation[0][0], rotation[0][1], rotation[0][2], 0, rotation[1][0], rotation[1][1], rotation[1][2], 0, rotation[2][0], rotation[2][1], rotation[2][2], 0, 0, 0, 0, 1);
    baseQuaternion.setFromRotationMatrix(matrix);
  }
  const yawQuaternion = new THREE.Quaternion(), yawAxis = new THREE.Vector3(0, 1, 0);
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = preference.matches, paused = false, visible = true, destroyed = false, contextLost = false, mobile = false;
  let frame = 0, lastTime = 0, nextDrawTime = 0, lastReport = 0;
  let targetAngle = 0, currentAngle = 0, lastManual = -Infinity;
  let targetX = 3, targetY = .55, targetScale = .82;
  const pointer = { y: 0, active: false, id: null, startX: 0, startY: 0 };
  const normalizeAngle = value => THREE.MathUtils.euclideanModulo(value, 360);
  const smooth = (value, target, delta, speed = 6) => THREE.MathUtils.lerp(value, target, 1 - Math.exp(-delta * speed));
  function updatePose(delta = 1, manual = false) {
    portrait.position.x = smooth(portrait.position.x, targetX, delta);
    portrait.position.y = smooth(portrait.position.y, targetY, delta);
    portrait.scale.setScalar(smooth(portrait.scale.x, targetScale, delta));
    currentAngle = manual ? targetAngle : smooth(currentAngle, targetAngle, delta, 12);
    if (Math.abs(currentAngle - targetAngle) < .015) currentAngle = targetAngle;
    yawQuaternion.setFromAxisAngle(yawAxis, THREE.MathUtils.degToRad(currentAngle));
    mesh.quaternion.copy(baseQuaternion).multiply(yawQuaternion);
    updateBlend(currentAngle);
    portrait.rotation.x = reducedMotion ? 0 : pointer.y * .025;
  }
  function renderOnce() { if (!destroyed && !contextLost) renderer.render(scene, camera); }
  function canAnimate() { return !paused && !reducedMotion && visible && !document.hidden && !contextLost && !destroyed; }
  function animate(time) {
    frame = 0;
    if (!canAnimate()) return;
    const interval = 1000 / 60;
    if (!lastTime) nextDrawTime = time;
    if (time + .5 < nextDrawTime) { frame = requestAnimationFrame(animate); return; }
    const delta = Math.min((time - (lastTime || time)) / 1000, .055);
    lastTime = time; nextDrawTime = Math.max(nextDrawTime + interval, time + interval * .25);
    if (!pointer.active && time - lastManual > 2500) targetAngle += delta * 12;
    updatePose(delta); renderOnce();
    if (time - lastReport > 65) { onAngleChange?.(normalizeAngle(currentAngle)); lastReport = time; }
    frame = requestAnimationFrame(animate);
  }
  function wake() {
    if (canAnimate() && !frame) { lastTime = 0; frame = requestAnimationFrame(animate); }
    else if (!canAnimate() && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  function setAngle(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || destroyed) return;
    const turn = THREE.MathUtils.euclideanModulo(parsed - currentAngle + 180, 360) - 180;
    targetAngle = currentAngle + turn; lastManual = performance.now();
    onAngleChange?.(normalizeAngle(targetAngle));
    if (paused || reducedMotion || !visible || document.hidden) { updatePose(10, true); renderOnce(); }
    else wake();
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect(), width = Math.max(1, bounds.width), height = Math.max(1, bounds.height), aspect = width / height;
    mobile = width < 761;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.7));
    renderer.setSize(width, height, false);
    const worldHeight = mobile ? 7.95 : 7.88;
    camera.left = -worldHeight * aspect / 2; camera.right = worldHeight * aspect / 2;
    camera.top = worldHeight / 2; camera.bottom = -worldHeight / 2; camera.updateProjectionMatrix();
    targetX = mobile ? .05 : worldHeight * aspect * .205;
    targetY = mobile ? 2.1 : .55; targetScale = mobile ? .40 : .82;
    updatePose(10, true); renderOnce(); wake();
  }
  function onPointerDown(event) {
    if (event.button > 0) return;
    pointer.active = true; pointer.id = event.pointerId; pointer.startX = event.clientX; pointer.startY = event.clientY;
    lastManual = performance.now();
    try { canvas.setPointerCapture(event.pointerId); } catch {}
  }
  function onPointerMove(event) {
    const bounds = canvas.getBoundingClientRect();
    if (!paused && !reducedMotion) pointer.y = THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - .44) * 2, -1, 1);
    if (!pointer.active) return;
    const dx = event.clientX - pointer.startX, dy = event.clientY - pointer.startY;
    if (Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 2) { setAngle(targetAngle + dx * .48); pointer.startX = event.clientX; pointer.startY = event.clientY; }
  }
  function onPointerUp() {
    pointer.active = false; lastManual = performance.now();
    try { if (pointer.id !== null && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id); } catch {}
    pointer.id = null;
  }
  function onPointerLeave() { pointer.y = 0; }
  function onVisibilityChange() { wake(); }
  function onMotionPreference(event) { reducedMotion = event.matches; if (reducedMotion) { pointer.y = 0; updatePose(10, true); renderOnce(); } wake(); }
  function onContextLost(event) { event.preventDefault(); contextLost = true; wake(); canvas.dispatchEvent(new CustomEvent('scene-unavailable')); }
  function onContextRestored() { contextLost = false; resize(); canvas.dispatchEvent(new CustomEvent('scene-restored')); }
  const originalTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibilityChange);
  preference.addEventListener('change', onMotionPreference);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }, { rootMargin: '60px' }); visibilityObserver.observe(canvas);
  resize(); onReady?.(); onAngleChange?.(normalizeAngle(currentAngle)); wake();
  return {
    setAngle, getAngle: () => normalizeAngle(currentAngle),
    setPaused(value) { paused = Boolean(value); pointer.y = 0; wake(); if (paused) { targetAngle = currentAngle; updatePose(10, true); renderOnce(); onAngleChange?.(normalizeAngle(currentAngle)); } },
    setChapter() {},
    dispose() {
      if (destroyed) return;
      destroyed = true; if (frame) cancelAnimationFrame(frame); onPointerUp();
      resizeObserver.disconnect(); visibilityObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp); canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
      document.removeEventListener('visibilitychange', onVisibilityChange); preference.removeEventListener('change', onMotionPreference);
      canvas.style.touchAction = originalTouchAction; scene.clear(); release();
    },
  };
}
