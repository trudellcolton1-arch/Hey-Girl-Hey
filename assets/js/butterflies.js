/* Hey Girl butterflies — the real butterflies from the H.E.Y. G.I.R.L. logo artwork,
   cut out of /assets/img/logo.jpg with transparent backgrounds and animated with CSS.
   Each butterfly is two wing-half images (split along the body) that flap in 3D,
   while the whole butterfly drifts on a gentle flight path.
   Decorative only: pointer-events none, skipped entirely when the user prefers reduced motion. */
(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var BASE = '/assets/img/butterflies/';
  /* Natural sizes of the cutout masters (left half + right half, split at the body). */
  var VARIANTS = {
    pink: { ar: '263 / 223', w: 132, h: 223 },
    teal: { ar: '143 / 155', w: 72,  h: 155 },
    gold: { ar: '113 / 127', w: 57,  h: 127 }
  };

  function half(variant, side) {
    var v = VARIANTS[variant];
    var file = variant + '-' + side;
    return '<picture class="bfly__w bfly__w--' + side + '">' +
      '<source type="image/webp" srcset="' + BASE + file + '.webp">' +
      '<img src="' + BASE + file + '.png" alt="" width="' + v.w + '" height="' + v.h + '" decoding="async">' +
      '</picture>';
  }

  function build(variant) {
    var b = document.createElement('div');
    b.className = 'bfly';
    b.innerHTML = half(variant, 'l') + half(variant, 'r');
    b.style.setProperty('--ar', VARIANTS[variant].ar);
    return b;
  }

  var isHome = !!document.querySelector('main .hero');
  var small = window.innerWidth < 700;
  /* Elegant, not cluttered: a modest flock on the home page, a subtler one elsewhere. */
  var count = isHome ? (small ? 5 : 7) : (small ? 2 : 4);
  var order = ['pink', 'gold', 'teal', 'pink', 'teal', 'gold', 'pink'];

  var layer = document.createElement('div');
  layer.className = 'butterflies';
  layer.setAttribute('aria-hidden', 'true');

  for (var i = 0; i < count; i++) {
    var variant = order[i % order.length];
    var b = build(variant);
    var big = variant === 'pink';
    var min = (isHome ? (big ? 44 : 34) : (big ? 34 : 26));
    var max = (isHome ? (big ? (small ? 64 : 76) : (small ? 46 : 56)) : (big ? 46 : 36));
    var size = Math.round(min + Math.random() * (max - min));
    var heroZone = isHome && i < 3; /* let a few start around the hero */
    b.style.setProperty('--size', size + 'px');
    b.style.setProperty('--x', (4 + Math.random() * 84) + 'vw');
    b.style.setProperty('--y', (heroZone ? 8 + Math.random() * 40 : 15 + Math.random() * 70) + 'vh');
    b.style.setProperty('--dx', ((Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 22)) + 'vw');
    b.style.setProperty('--dy', ((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 18)) + 'vh');
    b.style.setProperty('--drift', (22 + Math.random() * 16) + 's');
    b.style.setProperty('--flap', (0.55 + Math.random() * 0.35) + 's');
    b.style.setProperty('--delay', (-Math.random() * 30) + 's');
    b.style.setProperty('--sx', Math.random() < 0.4 ? '-1' : '1'); /* some face the other way */
    b.style.setProperty('--o', isHome ? '0.95' : '0.8');
    layer.appendChild(b);
  }
  document.body.appendChild(layer);
})();
