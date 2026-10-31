/* Scroll-scrubbed 3D depth for everything below the hero. Sections arrive as tilted slabs
   from deep in the page and sink into the dark while the next one slides over them,
   headlines flip up line by line, portraits swing on their vertical axis, and list rows
   fold down like split-flap cards. Pure transforms, so layout and anchors never move. */
export function initDepth() {
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);
  const out = t => 1 - Math.pow(1 - t, 3);
  const styles = new WeakMap();
  const set = (el, prop, value) => {
    let cache = styles.get(el);
    if (!cache) styles.set(el, cache = {});
    if (cache[prop] === value) return;
    cache[prop] = value;
    el.style.setProperty(prop, value);
  };

  /* ---------- sections: slab in, sink out ---------- */
  const sections = $$('main > section').filter(s => s.id !== 'home').map((el, i) => {
    el.classList.add('depth-section');
    el.style.zIndex = String(i + 2);
    const shade = document.createElement('div');
    shade.className = 'depth-shade'; shade.setAttribute('aria-hidden', 'true');
    el.append(shade);
    return { el, shade, top: 0, height: 0 };
  });
  const last = sections.length - 1;

  /* ---------- headlines: one 3D hinge per line ---------- */
  const headlines = $$('#about-title, #skills-title, #recognition-title, #speaking-title, #writing-title, #moments-title, #contact-title').map(h => {
    const groups = [[]];
    for (const node of [...h.childNodes]) node.nodeName === 'BR' ? groups.push([]) : groups.at(-1).push(node);
    const text = g => g.filter(n => !n.getAttribute?.('aria-hidden')).map(n => n.textContent).join('').trim();
    if (!h.hasAttribute('aria-label')) h.setAttribute('aria-label', groups.map(text).filter(Boolean).join(' ').replace(/\s+/g, ' '));
    h.textContent = '';
    const lines = groups.filter(g => g.some(n => n.textContent.trim())).map(nodes => {
      const line = document.createElement('span'); line.className = 'depth-line'; line.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span'); inner.className = 'depth-line-inner';
      inner.append(...nodes); line.append(inner); h.append(line);
      return inner;
    });
    return { h, lines };
  });

  /* ---------- swinging pieces ---------- */
  const one = s => document.querySelector(s);
  const pieces = [
    { el: one('.about-visual'), kind: 'swing' },
    { el: one('.about-letter'), kind: 'letter' },
    { el: one('.skill-layout'), kind: 'rise' },
    { el: one('.speaking-portrait'), kind: 'portrait' },
    { el: one('.gallery'), kind: 'door' },
    { el: one('.contact-content'), kind: 'zoom' }
  ].filter(p => p.el).map(p => ({ ...p, top: 0, height: 0 }));

  /* ---------- rows: split-flap fold ---------- */
  const rows = new Set();
  const rowObserver = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? rows.add(e.target) : (rows.delete(e.target), e.target.style.removeProperty('transform'), styles.delete(e.target));
  }, { rootMargin: '0px 0px 80px 0px' });
  const watchRows = () => $$('.achievement-row, .publication-row').forEach(r => { if (!r.dataset.depth) { r.dataset.depth = '1'; rowObserver.observe(r); } });
  watchRows();
  new MutationObserver(() => { watchRows(); measure(); }).observe(document.querySelector('main'), { childList: true, subtree: true });

  /* layout positions ignore transforms, so the scrub never feeds back into itself */
  const docTop = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
  function measure() {
    for (const s of sections) { s.top = docTop(s.el); s.height = s.el.offsetHeight; }
    for (const p of pieces) { p.top = docTop(p.el); p.height = p.el.offsetHeight; }
  }
  measure();
  new ResizeObserver(measure).observe(document.body);
  addEventListener('load', measure);

  let lastY = scrollY, velocity = 0, skew = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const y = scrollY, vh = innerHeight, small = innerWidth < 761;
    const k = small ? .55 : 1, persp = small ? 900 : 1500;
    const dy = y - lastY; lastY = y;
    velocity += (dy - velocity) * .18;
    skew += ((small ? 0 : clamp(velocity * .045, -1.6, 1.6)) - skew) * .2;
    // read every rect before the first style write so the frame lays out only once
    const headRects = headlines.map(({ h }) => h.getBoundingClientRect());
    const rowTops = [...rows].map(row => [row, row.getBoundingClientRect().top]);

    sections.forEach((s, i) => {
      const top = s.top - y, bottom = top + s.height;
      if (bottom < -vh * .2 || top > vh * 1.2) { if (styles.get(s.el)?.transform !== 'none') { set(s.el, 'transform', 'none'); set(s.el, 'clip-path', 'none'); set(s.el, 'will-change', 'auto'); set(s.shade, 'opacity', '0'); } return; }
      const enter = 1 - smooth(clamp((vh - top) / (vh * .85)));
      const leave = i < last ? smooth(clamp((vh - bottom) / vh)) : 0;
      const visTop = Math.max(top, 0), visBottom = Math.min(bottom, vh);
      const originY = clamp((visTop + visBottom) / 2 - top, 0, s.height);
      const tilt = enter * 15 * k - leave * 9 * k;
      const z = -(enter * 340 + leave * 380) * k;
      const lift = enter * 90 * k + leave * vh * .42;
      const radius = Math.max(enter, leave) * (small ? 26 : 44);
      const idle = enter < .001 && leave < .001 && Math.abs(skew) < .02;
      set(s.el, 'transform-origin', `50% ${originY.toFixed(0)}px`);
      set(s.el, 'transform', idle ? 'none' : `perspective(${persp}px) translate3d(0,${lift.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) skewY(${skew.toFixed(2)}deg)`);
      set(s.el, 'clip-path', radius > .5 ? `inset(0 round ${radius.toFixed(1)}px)` : 'none');
      set(s.el, 'will-change', idle ? 'auto' : 'transform');
      set(s.shade, 'opacity', (leave * .72).toFixed(3));
    });

    headlines.forEach(({ lines }, hi) => {
      const r = headRects[hi];
      if (r.bottom < -50 || r.top > vh + 50) return;
      const p = clamp((vh * .96 - r.top) / (vh * .42));
      const n = lines.length, stagger = .32;
      lines.forEach((line, j) => {
        const t = out(clamp(p * (1 + stagger * (n - 1)) - j * stagger));
        set(line, 'transform', t > .999 ? 'none' : `translate3d(0,${((1 - t) * 40).toFixed(1)}px,0) rotateX(${(-(1 - t) * 96).toFixed(1)}deg)`);
        set(line, 'opacity', t > .999 ? '1' : clamp(t * 1.8).toFixed(3));
      });
    });

    for (const p of pieces) {
      const top = p.top - y;
      if (top > vh * 1.3 || top + p.height < -vh * .3) continue;
      const center = ((top + p.height / 2) - vh / 2) / vh;          // -1 above .. 0 centred .. 1 below
      const enter = smooth(clamp((vh - top) / (vh * .9)));
      const c = clamp(center, -1.2, 1.2);
      let t = '';
      if (p.kind === 'swing') t = `perspective(${persp}px) rotateY(${(-c * 30 * k).toFixed(2)}deg) rotateX(${(c * 6 * k).toFixed(2)}deg) translateZ(${(-Math.abs(c) * 120 * k).toFixed(1)}px)`;
      if (p.kind === 'letter') t = `translate3d(${(c * 70 * k).toFixed(1)}px,${(c * 140 * k).toFixed(1)}px,0) rotate(${(-8 + c * 14).toFixed(2)}deg) scale(${(1 + Math.abs(c) * .25).toFixed(3)})`;
      if (p.kind === 'rise') t = `perspective(${persp}px) translate3d(0,${((1 - enter) * 120 * k).toFixed(1)}px,${(-(1 - enter) * 520 * k).toFixed(1)}px) rotateX(${((1 - enter) * 38 * k).toFixed(2)}deg)`;
      if (p.kind === 'portrait') t = `perspective(${persp}px) rotateY(${(c * 26 * k).toFixed(2)}deg) scale(${(1.06 + Math.abs(c) * .08).toFixed(3)})`;
      if (p.kind === 'door') t = `perspective(${persp}px) rotateY(${(-(1 - enter) * 42 * k).toFixed(2)}deg) translateZ(${(-(1 - enter) * 260 * k).toFixed(1)}px)`;
      if (p.kind === 'zoom') t = `perspective(${persp}px) translate3d(0,${((1 - enter) * 160 * k).toFixed(1)}px,${(-(1 - enter) * 700 * k).toFixed(1)}px) rotateX(${((1 - enter) * 28 * k).toFixed(2)}deg)`;
      set(p.el, 'transform', t);
    }

    for (const [row, rowTop] of rowTops) {
      const t = out(clamp((vh - rowTop) / (vh * .3)));
      set(row, 'transform', t > .999 ? 'none' : `perspective(900px) rotateX(${(-(1 - t) * 80).toFixed(1)}deg)`);
    }
  }
  document.documentElement.classList.add('depth-on');
  requestAnimationFrame(frame);
}
