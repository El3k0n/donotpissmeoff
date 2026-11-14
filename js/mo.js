/* Mo's animation. No library: each large illustration (<img data-mo="pose">) is
   replaced by an inline SVG that shows the same PNG twice:

     1. the still part: the whole picture with a hole where the moving part is
     2. the moving part: the same picture clipped to that area, in a <g> that
        style.css rotates (.mo-head) or flaps (.mo-wing)

   Eyelids and steam are drawn on top as vectors. Without JavaScript the plain
   images stay. All coordinates are pixels of the artwork in assets/, so they
   need a review whenever one of those files is replaced (docs/mo-animation.md). */
(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // moving: outline of the part that moves.  hole: what to cut out of the still
  // layer (slightly smaller, so no gap shows while the part rotates).
  // eyes: [cx, cy, rx, ry] of each eyelid.  steam: paths of the coffee steam.
  const POSES = {
    laptop: {
      width: 1254, height: 1254, group: 'mo-head',
      moving: 'M0 0H1254V600H0Z',
      hole: 'M0 0H1254V590H0Z',
      eyes: [[477, 390, 39, 45], [615, 402, 54, 54]],
      steam: [
        'M558 217 C530 195 586 182 558 160 S538 132 565 114',
        'M591 208 C617 182 560 169 589 143 S617 112 588 88',
        'M555 143 C523 122 580 105 553 82 S540 51 565 39'
      ]
    },
    annoyed: {
      width: 1254, height: 1254, group: 'mo-head',
      moving: 'M200 150H700V500H200Z',
      hole: 'M200 150H700V490H200Z',
      eyes: [[352, 360, 34, 42], [477, 347, 53, 55]]
    },
    sign: {
      width: 1512, height: 1040, group: 'mo-head',
      moving: 'M0 0H1512V310H0Z',
      hole: 'M0 0H1512V300H0Z',
      eyes: [[565, 140, 50, 52]]
    },
    fly: {
      width: 2142, height: 734, group: 'mo-wing',
      moving: 'M670 210L710 90L1000 -40H1510V400L1110 480L820 570L670 400Z',
      hole: 'M740 210V90L1000 -40H1510V400L1110 480L850 510L740 380Z'
    }
  };

  let count = 0;

  function svg(tag, attributes = {}, children = []) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
    children.forEach((child) => el.appendChild(child));
    return el;
  }

  function animate(img) {
    const name = img.dataset.mo;
    const pose = POSES[name];
    if (!pose) { return; }

    const id = `mo-${++count}`;
    const { width, height } = pose;
    const frame = `M0 0H${width}V${height}H0Z`;
    const picture = (clip) => svg('use', { href: `#${id}-art`, 'clip-path': `url(#${id}-${clip})` });

    const moving = svg('g', { class: pose.group }, [picture('moving')]);
    if (pose.eyes) {
      moving.appendChild(svg('g', { class: 'mo-eyelids', fill: '#000' },
        pose.eyes.map(([cx, cy, rx, ry]) => svg('ellipse', { cx, cy, rx, ry }))));
    }

    const root = svg('svg', {
      // keeps the image's classes, so it is sized exactly like the <img> it replaces
      class: `${img.className} mo-art mo-${name}`,
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
      'aria-label': img.alt
    }, [
      svg('defs', {}, [
        svg('image', { id: `${id}-art`, href: img.getAttribute('src'), width, height }),
        svg('clipPath', { id: `${id}-moving` }, [svg('path', { d: pose.moving })]),
        svg('clipPath', { id: `${id}-still` }, [svg('path', { d: `${frame} ${pose.hole}`, 'clip-rule': 'evenodd' })])
      ]),
      picture('still'),
      moving
    ]);

    if (pose.steam) {
      root.appendChild(svg('g', { class: 'mo-steam', fill: 'none', stroke: '#000', 'stroke-width': 7, 'stroke-linecap': 'round' },
        pose.steam.map((d) => svg('path', { d }))));
    }

    img.replaceWith(root);
  }

  document.querySelectorAll('img[data-mo]').forEach(animate);

  // Pause what is off-screen. Poses hidden by main.js count as not intersecting.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('mo-paused', !entry.isIntersecting));
    }, { rootMargin: '80px' });
    document.querySelectorAll('.mo-art').forEach((el) => observer.observe(el));
  }
})();
