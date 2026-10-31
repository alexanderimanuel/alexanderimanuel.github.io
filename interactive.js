/* Interactive layer: intro counter, hero choreography, count-up stats, text scramble,
   scroll-reactive marquee, image wipes, cursor follower and hero scroll parallax.
   Everything degrades to the static page without JS or with reduced motion. */
export function initInteractive() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ease = t => 1 - Math.pow(2, -10 * t);              // expo out
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------- count-up numbers ---------- */
  function prepareCount(el) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!node) return null;
    const raw = node.textContent.trim();
    const match = raw.match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
    if (!match) return null;
    const [, pre, num, post] = match;
    const decimals = (num.split('.')[1] || '').length;
    const pad = num.includes('.') ? 0 : num.length;
    const target = parseFloat(num);
    const format = v => pre + (decimals ? v.toFixed(decimals) : String(Math.round(v)).padStart(pad, '0')) + post;
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    node.textContent = format(0);
    return { el, node, target, format, done: false };
  }
  function runCount(c, duration = 1700) {
    if (c.done) return; c.done = true;
    const start = performance.now();
    c.el.classList.add('is-counting');
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      c.node.textContent = c.format(c.target * ease(t));
      if (t < 1) requestAnimationFrame(step);
      else { c.node.textContent = c.format(c.target); c.el.classList.remove('is-counting'); c.el.classList.add('counted'); }
    };
    requestAnimationFrame(step);
  }

  /* ---------- text scramble ---------- */
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*+';
  function scramble(el, duration = 720) {
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
    if (!nodes.length || el.dataset.scrambled) return;
    el.dataset.scrambled = '1';
    const finals = nodes.map(n => n.textContent);
    const total = finals.join('').length;
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const revealed = Math.floor(easeInOut(t) * total);
      let index = 0;
      nodes.forEach((n, k) => {
        n.textContent = [...finals[k]].map(ch => {
          const i = index++;
          if (ch === ' ' || i < revealed) return ch;
          return glyphs[(Math.random() * glyphs.length) | 0];
        }).join('');
      });
      if (t < 1) requestAnimationFrame(step); else nodes.forEach((n, k) => { n.textContent = finals[k]; });
    };
    requestAnimationFrame(step);
  }

  /* ---------- hero title letters ---------- */
  function splitLetters(title) {
    if (!title || title.dataset.split) return [];
    title.dataset.split = '1';
    title.setAttribute('aria-label', [...title.children].map(c => c.textContent.trim()).join(' ').replace(/\s+/g, ' '));
    const letters = [];
    const walk = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent) {
            if (ch === ' ') { frag.append(' '); continue; }
            const span = document.createElement('span');
            span.className = 'hero-letter'; span.setAttribute('aria-hidden', 'true'); span.textContent = ch;
            frag.append(span); letters.push(span);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) { child.setAttribute('aria-hidden', 'true'); walk(child); }
      }
    };
    walk(title);
    return letters;
  }

  /* ---------- intro ---------- */
  const intro = $('#intro');
  const wrap = $('#scene-wrap');
  function heroTimeline() {
    root.classList.add('hero-live');
    if (reduced) return;
    const header = $$('.header > *');
    header.forEach((el, i) => el.animate([{ opacity: 0, translate: '0 -18px' }, { opacity: 1, translate: '0 0' }], { duration: 700, delay: 80 + i * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    const eyebrow = $('.hero-eyebrow');
    if (eyebrow) { eyebrow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: 'backwards' }); scramble(eyebrow, 820); }
    const letters = splitLetters($('#hero-title'));
    letters.forEach((l, i) => l.animate([
      { opacity: 0, transform: 'translateY(0.9em) rotate(6deg)', filter: 'blur(6px)' },
      { opacity: 1, transform: 'translateY(0) rotate(0)', filter: 'blur(0)' }
    ], { duration: 900, delay: 160 + i * 28, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    const after = 160 + letters.length * 28;
    [$('.hero-description'), ...$$('.hero-actions > *'), $('.scene-interface'), ...$$('.hero-bottom > *')].filter(Boolean).forEach((el, i) =>
      el.animate([{ opacity: 0, translate: '0 22px' }, { opacity: 1, translate: '0 0' }], { duration: 800, delay: after + i * 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  }
  function runIntro() {
    if (!intro) { heroTimeline(); return; }
    if (reduced) { intro.remove(); heroTimeline(); return; }
    const counter = $('.intro-count', intro), bar = $('.intro-bar', intro);
    const started = performance.now();
    let shown = 0, last = started, readyAt = 0, finishing = false;
    const isReady = () => wrap?.classList.contains('ready') || wrap?.classList.contains('failed');
    const finish = () => {
      if (finishing) return;
      finishing = true;
      counter.textContent = '100'; bar.style.transform = 'scaleX(1)';
      intro.classList.add('intro-leave');
      setTimeout(heroTimeline, 260);
      setTimeout(() => intro.remove(), 1100);
    };
    // time-based easing so slow devices (low fps while the 3D compiles) still finish on time
    const tick = now => {
      if (finishing) return;
      const elapsed = now - started, dt = Math.min(now - last, 100); last = now;
      if (!readyAt && (isReady() || elapsed > 4500)) readyAt = now;
      const goal = readyAt ? 100 : 92 * (1 - Math.exp(-elapsed / 650));
      shown += (goal - shown) * (1 - Math.exp(-dt / (readyAt ? 70 : 130)));
      if (readyAt && (goal - shown < .6 || now - readyAt > 700)) shown = 100;
      counter.textContent = String(Math.floor(shown)).padStart(3, '0');
      bar.style.transform = `scaleX(${shown / 100})`;
      if (shown >= 100 && elapsed > 650) { finish(); return; }
      requestAnimationFrame(tick);
    };
    setTimeout(finish, 5600);
    requestAnimationFrame(tick);
    intro.addEventListener('click', () => { if (!readyAt) readyAt = performance.now(); }, { once: true });
  }

  /* ---------- reveal on scroll: counts, scrambles, image wipes ---------- */
  const counts = new Map();
  $$('.profile-facts strong, .archive-number, #speaker-count, #judge-count, .publication-total strong').forEach(el => {
    if (reduced) return;
    const c = prepareCount(el); if (c) counts.set(el, c);
  });
  const wipeSelector = '.about-visual > img, .award-photo > img, .speaking-portrait > img, .cutout-portrait > img';
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target; io.unobserve(el);
      if (counts.has(el)) runCount(counts.get(el));
      else if (el.matches('.eyebrow, .photo-index, .scene-caption strong, .skill-atlas-caption span')) scramble(el);
      else if (el.matches(wipeSelector)) wipe(el);
    }
  }, { threshold: .35 }) : null;
  function wipe(img, from = 'bottom') {
    if (reduced || !img.animate) return;
    const clip = from === 'left' ? 'inset(0 100% 0 0)' : 'inset(100% 0 0 0)';
    img.animate([{ clipPath: clip, scale: '1.14' }, { clipPath: 'inset(0 0 0 0)', scale: '1' }], { duration: 1150, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'backwards' });
  }
  if (io) {
    counts.forEach((_, el) => io.observe(el));
    $$('.eyebrow, .photo-index, .skill-atlas-caption span').forEach(el => io.observe(el));
    if (!reduced) $$(wipeSelector).forEach(el => io.observe(el));
  } else counts.forEach(c => runCount(c, 1));

  /* gallery changes get a sideways wipe */
  const gallery = $('#gallery');
  if (gallery && !reduced) new MutationObserver(() => { const img = $('.moment-photo img', gallery); if (img && !img.dataset.wiped) { img.dataset.wiped = '1'; wipe(img, 'left'); } }).observe(gallery, { childList: true });

  /* ---------- marquee + cursor + hero parallax: one animation loop ---------- */
  const marquees = $$('.marquee-track').map(track => {
    track.innerHTML += track.innerHTML;                       // seamless loop
    return { track, x: 0, width: 0 };
  });
  const measure = () => marquees.forEach(m => { m.width = m.track.scrollWidth / 2; });
  measure(); addEventListener('resize', measure, { passive: true });
  let lastY = scrollY, velocity = 0, direction = 1, last = performance.now();

  const hero = $('.hero');
  const sceneCanvas = $('#hero-canvas');
  const heroCopy = $('.hero-copy');

  let dot = null, ring = null, label = null, mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, cursorOn = false;
  if (fine && !reduced) {
    dot = document.createElement('div'); dot.className = 'cursor-dot';
    ring = document.createElement('div'); ring.className = 'cursor-ring';
    label = document.createElement('span'); label.className = 'cursor-label'; ring.append(label);
    document.body.append(ring, dot);
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (!cursorOn) { cursorOn = true; rx = mx; ry = my; root.classList.add('cursor-on'); }
      const t = e.target instanceof Element ? e.target : null;
      const onCanvas = t?.closest('#hero-canvas');
      const onPhoto = t?.closest('.moment-photo, .moment-thumbnails button');
      const onLink = t?.closest('a, button, summary, input[type=range], [role=tab]');
      ring.dataset.mode = onCanvas ? 'drag' : onPhoto ? 'view' : onLink ? 'link' : '';
      label.textContent = onCanvas ? 'DRAG' : onPhoto ? 'VIEW' : '';
    }, { passive: true });
    document.addEventListener('pointerleave', () => { cursorOn = false; root.classList.remove('cursor-on'); });
    addEventListener('pointerdown', () => ring.classList.add('is-down'), { passive: true });
    addEventListener('pointerup', () => ring.classList.remove('is-down'), { passive: true });
  }

  function loop(now) {
    const dt = Math.min(64, now - last) / 1000; last = now;
    const y = scrollY, dy = y - lastY; lastY = y;
    if (dy) direction = dy > 0 ? 1 : -1;
    velocity += (Math.min(60, Math.abs(dy)) - velocity) * .12;
    if (!document.hidden) {
      for (const m of marquees) {
        if (!m.width) continue;
        m.x -= (60 + velocity * 26) * dt * direction;
        if (m.x <= -m.width) m.x += m.width;
        if (m.x > 0) m.x -= m.width;
        m.track.style.transform = `translate3d(${m.x.toFixed(1)}px,0,0) skewX(${(-direction * Math.min(velocity, 30) * .25).toFixed(2)}deg)`;
      }
      if (hero && !reduced) {
        const h = hero.offsetHeight || 1;
        const p = Math.max(0, Math.min(1, y / h));
        if (sceneCanvas) { sceneCanvas.style.translate = `0 ${(p * 90).toFixed(1)}px`; sceneCanvas.style.opacity = wrap?.classList.contains('ready') ? String(1 - p * .75) : ''; }
        if (heroCopy) { heroCopy.style.translate = `0 ${(-p * 60).toFixed(1)}px`; heroCopy.style.opacity = String(1 - p * .9); }
      }
      if (ring && cursorOn) {
        rx += (mx - rx) * .2; ry += (my - ry) * .2;
        dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
        ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      }
    }
    requestAnimationFrame(loop);
  }
  if (!reduced) requestAnimationFrame(loop);

  runIntro();
}
