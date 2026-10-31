/* Progressive motion for Alex's personal archive. Content stays usable without it. */
export function initMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const body = document.body;
  const enterSelector = [
    '.affiliation', '.section-top > *', '.section-heading > *', '.about-copy > h2', '.bio > p', '.about-signature',
    '.about-visual', '.profile-facts > div', '.skill-atlas', '.skill-panel > *', '.skill-terms > span', '.skill-evidence li',
    '.recognition-intro > *', '.archive-tools > *', '.achievement-row', '.archive-status', '.show-all',
    '.speaking-content > *', '.engagement-stats > div', '.speaking-portrait', '.publication-row', '.publication-note',
    '.moment-photo', '.moment-story > *', '.moment-thumbnails > button', '.gallery-bottom > *',
    '.contact-pretitle', '#contact-title', '.instagram-link', 'footer > *', '.dialog-body > *', '#media-content > *'
  ].join(',');
  const tiltSelector = '.affiliation, .about-visual, .award-photo, .profile-facts > div, .engagement-stats > div, .moment-photo';
  const magneticSelector = '.header-contact, .text-cta, .text-link, .quiet-link, .instagram-link, .skill-node, .moment-nav button, .rotation-views button, .moment-thumbnails button, .dialog-close';
  const seen = new WeakSet();
  const animations = new Set();
  const sections = new Set();
  const photos = new Map();
  const pointerStates = new Map();
  let frame = 0, disposed = false, dirtyScroll = true, progress = -1;
  let currentTarget = null;
  const progressLine = document.createElement('div');
  progressLine.className = 'reading-progress';
  progressLine.setAttribute('aria-hidden', 'true');
  body.append(progressLine);
  body.classList.add('motion-enhanced');

  const track = animation => {
    animations.add(animation);
    const release = () => animations.delete(animation);
    animation.finished.then(release, release);
    return animation;
  };
  function enter(element) {
    if (seen.has(element)) return;
    seen.add(element);
    if (reduced.matches || !element.animate) return;
    const siblings = [...(element.parentElement?.children || [])];
    const delay = Math.min(siblings.indexOf(element) % 6, 4) * 55;
    track(element.animate([
      { opacity: 0, translate: `0 ${element.matches('h1 > *, h2, #contact-title') ? 38 : 22}px` },
      { opacity: 1, translate: '0 0' }
    ], { duration: element.matches('h2, #contact-title') ? 950 : 740, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
  }
  const entryObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      enter(entry.target);
      entryObserver.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -18px 0px' }) : null;

  const sectionObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.classList.toggle('motion-section-active', entry.isIntersecting && !reduced.matches);
      if (entry.isIntersecting) sections.add(entry.target); else sections.delete(entry.target);
    }
  }, { threshold: 0 }) : null;
  const photoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const photo = photos.get(entry.target);
      if (photo) photo.visible = entry.isIntersecting;
    }
    dirtyScroll = true;
    wake();
  }, { rootMargin: '60px' }) : null;
  function eachMatching(root, selector, callback) {
    if (!(root instanceof Element)) return;
    if (root.matches(selector)) callback(root);
    root.querySelectorAll(selector).forEach(callback);
  }
  function prepare(root) {
    eachMatching(root, enterSelector, element => {
      if (seen.has(element)) return;
      element.classList.add('motion-element');
      if (entryObserver && !reduced.matches) entryObserver.observe(element); else enter(element);
    });
    eachMatching(root, tiltSelector, element => element.classList.add('motion-tilt'));
    eachMatching(root, magneticSelector, element => element.classList.add('motion-magnetic'));
    eachMatching(root, '.about-visual > img, .speaking-portrait > img, .moment-photo > img', image => {
      if (photos.has(image)) return;
      image.classList.add('motion-parallax');
      photos.set(image, { visible: false, y: 0, target: 0, range: image.closest('.moment-photo') ? 6 : 10 });
      photoObserver?.observe(image);
    });
  }
  document.querySelectorAll('main > section, .affiliation-strip').forEach(section => sectionObserver?.observe(section));
  prepare(body);
  const mutationObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) prepare(node);
      for (const node of record.removedNodes) eachMatching(node, '.motion-element', element => entryObserver?.unobserve(element));
    }
    for (const [image] of photos) if (!image.isConnected) {
      photoObserver?.unobserve(image);
      photos.delete(image);
    }
    for (const [element] of pointerStates) if (!element.isConnected) pointerStates.delete(element);
    for (const animation of animations) if (!animation.effect?.target?.isConnected) animation.cancel();
    dirtyScroll = true;
    wake();
  });
  mutationObserver.observe(body, { childList: true, subtree: true });

  function stateFor(element) {
    let state = pointerStates.get(element);
    if (!state) {
      state = { x: 0, y: 0, tx: 0, ty: 0, glow: 0, targetGlow: 0, tilt: element.classList.contains('motion-tilt') };
      pointerStates.set(element, state);
    }
    return state;
  }
  function resetPointer() {
    if (currentTarget) {
      const state = stateFor(currentTarget);
      state.tx = state.ty = state.targetGlow = 0;
      currentTarget.classList.remove('motion-pointer-active');
    }
    currentTarget = null;
    wake();
  }
  function onPointer(event) {
    if (reduced.matches || !finePointer.matches || event.pointerType === 'touch') return;
    const element = event.target instanceof Element ? event.target.closest('.motion-tilt, .motion-magnetic') : null;
    if (element !== currentTarget) resetPointer();
    if (!element) return;
    currentTarget = element;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const state = stateFor(element);
    state.tx = Math.max(-1, Math.min(1, x * 2));
    state.ty = Math.max(-1, Math.min(1, y * 2));
    state.targetGlow = 1;
    element.style.setProperty('--motion-light-x', `${(x + 0.5) * 100}%`);
    element.style.setProperty('--motion-light-y', `${(y + 0.5) * 100}%`);
    element.classList.add('motion-pointer-active');
    wake();
  }
  function onClick(event) {
    if (reduced.matches) return;
    const control = event.target instanceof Element ? event.target.closest('button, .text-cta, .header-contact, .instagram-link') : null;
    if (!control || control.disabled || !control.animate) return;
    track(control.animate([{ scale: '1' }, { scale: '.95', offset: .3 }, { scale: '1' }], {
      duration: 320, easing: 'cubic-bezier(.16,1,.3,1)'
    }));
  }
  const scroll = () => { dirtyScroll = true; wake(); };
  function wake() {
    if (!frame && !disposed && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  function tick() {
    frame = 0;
    if (disposed || document.hidden || reduced.matches) return;
    let moving = false;
    if (dirtyScroll) {
      const next = Math.max(0, Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
      if (Math.abs(next - progress) > .0001) {
        progressLine.style.transform = `scaleX(${next})`;
        progress = next;
      }
      for (const [image, photo] of photos) if (photo.visible) {
        const rect = image.parentElement.getBoundingClientRect();
        photo.target = Math.max(-photo.range, Math.min(photo.range, (innerHeight / 2 - rect.top - rect.height / 2) / innerHeight * photo.range * 2));
      }
      dirtyScroll = false;
    }
    for (const [element, state] of pointerStates) {
      if (!element.isConnected) { pointerStates.delete(element); continue; }
      state.x += (state.tx - state.x) * .16;
      state.y += (state.ty - state.y) * .16;
      state.glow += (state.targetGlow - state.glow) * .16;
      if (state.tilt) {
        element.style.setProperty('--motion-tilt-x', `${-state.y * 4}deg`);
        element.style.setProperty('--motion-tilt-y', `${state.x * 5}deg`);
        element.style.setProperty('--motion-glow', String(state.glow));
      } else {
        element.style.setProperty('--motion-magnetic-x', `${state.x * 5}px`);
        element.style.setProperty('--motion-magnetic-y', `${state.y * 4}px`);
      }
      const unsettled = Math.abs(state.tx - state.x) + Math.abs(state.ty - state.y) + Math.abs(state.targetGlow - state.glow) > .002;
      moving ||= unsettled;
      if (!unsettled && state.targetGlow === 0) {
        element.style.removeProperty('--motion-tilt-x'); element.style.removeProperty('--motion-tilt-y');
        element.style.removeProperty('--motion-glow'); element.style.removeProperty('--motion-magnetic-x'); element.style.removeProperty('--motion-magnetic-y');
        pointerStates.delete(element);
      }
    }
    for (const [image, photo] of photos) if (photo.visible) {
      photo.y += (photo.target - photo.y) * .1;
      image.style.setProperty('--motion-parallax', `${photo.y.toFixed(2)}px`);
      moving ||= Math.abs(photo.target - photo.y) > .025;
    }
    if (moving) wake();
  }
  function onVisibility() {
    body.classList.toggle('motion-document-hidden', document.hidden);
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    if (!document.hidden) { dirtyScroll = true; wake(); }
  }
  function onPreference() {
    resetPointer();
    body.classList.toggle('motion-is-reduced', reduced.matches);
    if (reduced.matches) {
      for (const animation of animations) animation.cancel();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      for (const [image] of photos) image.style.removeProperty('--motion-parallax');
      for (const section of sections) section.classList.remove('motion-section-active');
    } else {
      for (const section of sections) section.classList.add('motion-section-active');
      dirtyScroll = true;
      wake();
    }
  }
  document.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('pointerleave', resetPointer);
  document.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('scroll', scroll, { passive: true });
  addEventListener('resize', scroll, { passive: true });
  reduced.addEventListener('change', onPreference);
  onPreference();

  return function disposeMotion() {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    entryObserver?.disconnect(); sectionObserver?.disconnect(); photoObserver?.disconnect(); mutationObserver.disconnect();
    for (const animation of animations) animation.cancel();
    document.removeEventListener('pointermove', onPointer); document.removeEventListener('pointerleave', resetPointer);
    document.removeEventListener('click', onClick); document.removeEventListener('visibilitychange', onVisibility);
    removeEventListener('scroll', scroll); removeEventListener('resize', scroll); reduced.removeEventListener('change', onPreference);
    for (const [element] of pointerStates) for (const property of ['--motion-tilt-x', '--motion-tilt-y', '--motion-glow', '--motion-magnetic-x', '--motion-magnetic-y']) element.style.removeProperty(property);
    for (const [image] of photos) image.style.removeProperty('--motion-parallax');
    document.querySelectorAll('.motion-section-active').forEach(element => element.classList.remove('motion-section-active'));
    body.classList.remove('motion-enhanced', 'motion-is-reduced', 'motion-document-hidden');
    progressLine.remove();
  };
}
