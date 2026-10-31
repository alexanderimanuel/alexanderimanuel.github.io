/* Scroll-scrubbed 3D transitions for everything below the hero. Every section has its own
   way in and out, so no two hand-offs look alike:
     story        opens through an iris, then folds away over a cube edge
     skills       turns in as the next face of that cube, then sinks under blinds
     recognition  is revealed by venetian blinds, then gets pushed aside
     speaking     swings in like a door hinged on the right, then flies past the camera
     writing      zooms out of a portal, then gets twisted away
     moments      is tossed in with a twist, then sinks under a red flood
     contact      floods up with a curved edge
   Headlines, portraits and lists inside each section get their own moves too.
   Pure transforms/clips, so layout and anchors never move. */
export function initDepth() {
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const one = s => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);
  const out = t => 1 - Math.pow(1 - t, 3);
  const f = (n, d = 1) => n.toFixed(d);
  const styles = new WeakMap();
  const set = (el, prop, value) => {
    let cache = styles.get(el);
    if (!cache) styles.set(el, cache = {});
    if (cache[prop] === value) return;
    cache[prop] = value;
    el.style.setProperty(prop, value);
  };

  /* ---------- per-section choreography ----------
     enter(c): c.e goes 0 -> 1 while the section's top rises from the viewport bottom to 15%.
     leave(c): c.l goes 0 -> 1 while the next section covers this one.
     Both return { t: transform, o: origin, clip, mask, shade }. */
  const P = c => `perspective(${c.persp}px)`;
  const choreo = {
    story: {
      enter: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `scale(${f(1 + (1 - c.e) * .2, 3)})`,
        clip: `circle(${f(c.e * Math.hypot(c.vw / 2, c.visH) * 1.08, 0)}px at 50% ${f(c.mid, 0)}px)` }),
      leave: c => ({ o: `50% ${f(c.h, 0)}px`, t: `${P(c)} rotateX(${f(c.l * 58 * c.k, 2)}deg)`, shade: c.l * .55 })
    },
    skills: {
      enter: c => ({ o: '50% 0px', t: `${P(c)} rotateX(${f(-(1 - c.e) * 58 * c.k, 2)}deg)` }),
      leave: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `scale(${f(1 - c.l * .08, 3)})`, shade: c.l * .75 })
    },
    recognition: {
      enter: c => {
        const slat = c.vw / (c.small ? 5 : 9), p = clamp(c.e * 1.2), w = p * slat;   // slats close a little early so no hairlines linger
        return { o: `50% ${f(c.mid, 0)}px`, t: `translate3d(0,${f((1 - c.e) * 70)}px,0)`,
          mask: p < 1 ? `repeating-linear-gradient(90deg,#000 0 ${f(w)}px,transparent ${f(w)}px ${f(slat)}px)` : '' };
      },
      leave: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `translate3d(${f(-c.l * c.vw * .1)}px,${f(c.l * c.vh * .2)}px,0) scale(${f(1 - c.l * .06, 3)})`, shade: c.l * .7 })
    },
    speaking: {
      enter: c => ({ o: `100% ${f(c.mid, 0)}px`, t: `${P(c)} rotateY(${f(-(1 - c.e) * 72 * c.k, 2)}deg)` }),
      leave: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `scale(${f(1 + c.l * .4, 3)})`, shade: c.l * .85 })
    },
    writing: {
      enter: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `scale(${f(.5 + .5 * c.e, 3)})`, clip: `inset(0 round ${f((1 - c.e) * 90)}px)` }),
      leave: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `translate3d(0,${f(c.l * c.vh * .3)}px,0) rotate(${f(c.l * 5, 2)}deg) scale(${f(1 - c.l * .12, 3)})`, shade: c.l * .7 })
    },
    moments: {
      enter: c => ({ o: `50% ${f(c.mid, 0)}px`,
        t: `${P(c)} translate3d(0,${f((1 - c.e) * 150 * c.k)}px,0) rotate(${f(-(1 - c.e) * 11 * c.k, 2)}deg) rotateY(${f((1 - c.e) * 24 * c.k, 2)}deg) scale(${f(.8 + .2 * c.e, 3)})`,
        clip: `inset(0 round ${f((1 - c.e) * 34)}px)` }),
      leave: c => ({ o: `50% ${f(c.mid, 0)}px`, t: `translate3d(0,${f(c.l * c.vh * .35)}px,0) scale(${f(1 - c.l * .05, 3)})`, shade: c.l * .75 })
    },
    contact: {
      enter: c => {
        const cy = c.visH + c.vh * .35, ry = c.e * (cy + 40), rx = c.vw * (.42 + .6 * c.e);
        return { o: '50% 0px', t: `translate3d(0,${f((1 - c.e) * 40)}px,0)`, clip: `ellipse(${f(rx, 0)}px ${f(ry, 0)}px at 50% ${f(cy, 0)}px)` };
      }
    }
  };

  const sections = $$('main > section').filter(s => s.id !== 'home').map((el, i, all) => {
    el.classList.add('depth-section');
    el.style.zIndex = String(i + 2);
    const shade = document.createElement('div');
    shade.className = 'depth-shade'; shade.setAttribute('aria-hidden', 'true');
    el.append(shade);
    return { el, shade, top: 0, height: 0, plan: choreo[el.id] || {}, hasNext: i < all.length - 1 };
  });

  /* ---------- headlines: each section moves its lines differently ---------- */
  const headlineMoves = {
    'about-title':       { o: '50% 100%', t: (u, j) => `translate3d(0,${f(u * 40)}px,0) rotateX(${f(-u * 96)}deg)` },                       // flip up
    'skills-title':      { o: '50% 50%',  t: (u, j) => `translate3d(${f((j % 2 ? 1 : -1) * u * 45)}vw,0,0) rotateY(${f((j % 2 ? -1 : 1) * u * 70)}deg)` }, // from both sides
    'recognition-title': { o: '0% 60%',   t: (u, j) => `scale(${f(1 + u * 1.6, 3)})` },                                                       // stamp
    'speaking-title':    { o: '0% 100%',  t: (u, j) => `translate3d(${f(-u * 160)}px,0,0) skewX(${f(u * 28)}deg)` },                           // skid in
    'writing-title':     { o: '50% 0%',   t: (u, j) => `translate3d(0,${f(-u * 50)}px,0) rotateX(${f(u * 100)}deg)` },                        // drop from above
    'moments-title':     { o: '0% 100%',  t: (u, j) => `translate3d(0,${f(u * 90)}px,0) rotate(${f((j % 2 ? 1 : -1) * u * 14)}deg)` },        // swing
    'contact-title':     { o: '0% 50%',   t: (u, j) => `translate3d(0,0,0) scale(${f(1 + u * 2.6, 3)})` }                                    // zoom from huge
  };
  const headlines = Object.keys(headlineMoves).map(id => document.getElementById(id)).filter(Boolean).map(h => {
    const groups = [[]];
    for (const node of [...h.childNodes]) node.nodeName === 'BR' ? groups.push([]) : groups.at(-1).push(node);
    const text = g => g.filter(n => !n.getAttribute?.('aria-hidden')).map(n => n.textContent).join('').trim();
    if (!h.hasAttribute('aria-label')) h.setAttribute('aria-label', groups.map(text).filter(Boolean).join(' ').replace(/\s+/g, ' '));
    h.textContent = '';
    const move = headlineMoves[h.id];
    const lines = groups.filter(g => g.some(n => n.textContent.trim())).map(nodes => {
      const line = document.createElement('span'); line.className = 'depth-line'; line.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span'); inner.className = 'depth-line-inner';
      inner.style.transformOrigin = move.o;
      inner.append(...nodes); line.append(inner); h.append(line);
      return inner;
    });
    return { h, lines, move };
  });

  /* ---------- pieces inside sections ---------- */
  const pieces = [
    { el: one('.about-visual'), kind: 'swing' },
    { el: one('.about-letter'), kind: 'letter' },
    { el: one('.skill-layout'), kind: 'rise' },
    { el: one('.speaking-portrait'), kind: 'portrait' },
    { el: one('.engagement-stats'), kind: 'flipcards' },
    { el: one('.gallery'), kind: 'floor' },
    { el: one('.instagram-link'), kind: 'spin' }
  ].filter(p => p.el).map(p => ({ ...p, top: 0, height: 0 }));

  /* ---------- rows: achievements fold like split-flaps, publications slide on a hinge ---------- */
  const rows = new Set();
  const rowObserver = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? rows.add(e.target) : (rows.delete(e.target), e.target.style.removeProperty('transform'), styles.delete(e.target));
  }, { rootMargin: '0px 0px 80px 0px' });
  const watchRows = () => $$('.achievement-row, .publication-row').forEach(r => { if (!r.dataset.depth) { r.dataset.depth = '1'; rowObserver.observe(r); } });
  watchRows();

  /* layout positions ignore transforms, so the scrub never feeds back into itself */
  const docTop = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
  function measure() {
    for (const s of sections) { s.top = docTop(s.el); s.height = s.el.offsetHeight; }
    for (const p of pieces) { p.top = docTop(p.el); p.height = p.el.offsetHeight; }
  }
  measure();
  new MutationObserver(() => { watchRows(); measure(); }).observe(one('main'), { childList: true, subtree: true });
  new ResizeObserver(measure).observe(document.body);
  addEventListener('load', measure);

  const reset = s => {
    set(s.el, 'transform', 'none'); set(s.el, 'clip-path', 'none'); set(s.el, 'mask-image', 'none'); set(s.el, '-webkit-mask-image', 'none');
    set(s.el, 'will-change', 'auto'); set(s.shade, 'opacity', '0');
  };

  let lastY = scrollY, velocity = 0, skew = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const y = scrollY, vh = innerHeight, vw = innerWidth, small = vw < 761;
    const k = small ? .6 : 1, persp = small ? 900 : 1500;
    const dy = y - lastY; lastY = y;
    velocity += (dy - velocity) * .18;
    skew += ((small ? 0 : clamp(velocity * .04, -1.4, 1.4)) - skew) * .2;
    // read every rect before the first style write so the frame lays out only once
    const headRects = headlines.map(({ h }) => h.getBoundingClientRect());
    const rowTops = [...rows].map(row => [row, row.getBoundingClientRect().top]);

    for (const s of sections) {
      const top = s.top - y, bottom = top + s.height;
      if (bottom < -vh * .2 || top > vh * 1.2) { reset(s); continue; }
      const visTop = Math.max(top, 0), visBottom = Math.min(bottom, vh);
      const c = { e: smooth(clamp((vh - top) / (vh * .85))), l: s.hasNext ? smooth(clamp((vh - bottom) / vh)) : 0,
        vh, vw, small, k, persp, h: s.height, visH: clamp(vh - top, 0, s.height), mid: clamp((visTop + visBottom) / 2 - top, 0, s.height) };
      const entering = s.plan.enter && c.e < .999, leaving = s.plan.leave && c.l > .001;
      const r = entering ? s.plan.enter(c) : leaving ? s.plan.leave(c) : {};
      const sk = Math.abs(skew) > .02 ? ` skewY(${f(skew, 2)}deg)` : '';
      set(s.el, 'transform-origin', r.o || '50% 50%');
      set(s.el, 'transform', r.t || sk ? `${r.t || ''}${sk}` : 'none');
      set(s.el, 'clip-path', r.clip || 'none');
      set(s.el, 'mask-image', r.mask || 'none'); set(s.el, '-webkit-mask-image', r.mask || 'none');
      set(s.el, 'will-change', r.t ? 'transform' : 'auto');
      set(s.shade, 'opacity', f(r.shade || 0, 3));
    }

    headlines.forEach(({ lines, move }, hi) => {
      const r = headRects[hi];
      if (r.bottom < -50 || r.top > vh + 50) return;
      const p = clamp((vh * .96 - r.top) / (vh * .42));
      const n = lines.length, stagger = .32;
      lines.forEach((line, j) => {
        const t = out(clamp(p * (1 + stagger * (n - 1)) - j * stagger));
        set(line, 'transform', t > .999 ? 'none' : move.t(1 - t, j));
        set(line, 'opacity', t > .999 ? '1' : f(clamp(t * 1.8), 3));
      });
    });

    for (const p of pieces) {
      const top = p.top - y;
      if (top > vh * 1.3 || top + p.height < -vh * .3) continue;
      const c = clamp(((top + p.height / 2) - vh / 2) / vh, -1.2, 1.2);   // -1 above .. 0 centred .. 1 below
      const u = 1 - smooth(clamp((vh - top) / (vh * .9)));                 // 1 before it enters .. 0 once in
      let t = '';
      if (p.kind === 'swing') t = `perspective(${persp}px) rotateY(${f(-c * 30 * k, 2)}deg) rotateX(${f(c * 6 * k, 2)}deg) translateZ(${f(-Math.abs(c) * 120 * k)}px)`;
      if (p.kind === 'letter') t = `translate3d(${f(c * 70 * k)}px,${f(c * 140 * k)}px,0) rotate(${f(-8 + c * 14, 2)}deg) scale(${f(1 + Math.abs(c) * .25, 3)})`;
      if (p.kind === 'rise') t = `perspective(${persp}px) translate3d(0,${f(u * 120 * k)}px,${f(-u * 520 * k)}px) rotateX(${f(u * 38 * k, 2)}deg)`;
      if (p.kind === 'portrait') t = `perspective(${persp}px) rotateY(${f(c * 26 * k, 2)}deg) scale(${f(1.06 + Math.abs(c) * .08, 3)})`;
      if (p.kind === 'flipcards') t = `perspective(${persp}px) rotateY(${f(u * 180, 1)}deg)`;
      if (p.kind === 'floor') t = `perspective(${persp}px) translate3d(0,${f(u * 80 * k)}px,0) rotateX(${f(u * 62 * k, 2)}deg)`;
      if (p.kind === 'spin') t = `perspective(${persp}px) rotateX(${f(u * -90, 1)}deg)`;
      set(p.el, 'transform', t);
    }

    for (const [row, rowTop] of rowTops) {
      const t = out(clamp((vh - rowTop) / (vh * .3))), u = 1 - t;
      const pub = row.classList.contains('publication-row');
      set(row, 'transform', t > .999 ? 'none' : pub
        ? `perspective(900px) translate3d(${f(u * 140 * k)}px,0,0) rotateY(${f(-u * 55)}deg)`
        : `perspective(900px) rotateX(${f(-u * 80)}deg)`);
    }
  }
  document.documentElement.classList.add('depth-on');
  requestAnimationFrame(frame);
}
