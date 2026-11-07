/* Hey Girl butterflies. Decorative, pointer-events none, skipped when the user prefers reduced motion. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var small = window.innerWidth < 700;
  var count = small ? 4 : 7;
  var colors = [['#ffd27a', '#d9a21b'], ['#ffffff', '#f4b6d4'], ['#8fd9e3', '#1aa3b5'], ['#ffe6f2', '#e68ab8'], ['#ffd27a', '#c93a84'], ['#b9ecf2', '#1aa3b5']];
  var layer = document.createElement('div');
  layer.className = 'butterflies';
  layer.setAttribute('aria-hidden', 'true');
  for (var i = 0; i < count; i++) {
    var c = colors[i % colors.length];
    var b = document.createElement('div');
    b.className = 'butterfly';
    var size = 30 + Math.round(Math.random() * 24);
    b.style.setProperty('--size', size + 'px');
    b.style.setProperty('--x', (5 + Math.random() * 90) + 'vw');
    b.style.setProperty('--y', (10 + Math.random() * 80) + 'vh');
    b.style.setProperty('--dx', ((Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 25)) + 'vw');
    b.style.setProperty('--dy', ((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 20)) + 'vh');
    b.style.setProperty('--drift', (18 + Math.random() * 16) + 's');
    b.style.setProperty('--flap', (0.35 + Math.random() * 0.25) + 's');
    b.style.setProperty('--delay', (-Math.random() * 20) + 's');
    b.innerHTML =
      '<svg viewBox="0 0 64 48" width="' + size + '" height="' + Math.round(size * 0.75) + '">' +
      '<g class="wing wing--l"><path d="M31 24 C22 2 2 2 4 18 C5 28 18 30 31 24 Z" fill="' + c[0] + '" stroke="#7a0b40" stroke-width="1.5" stroke-linejoin="round"/><path d="M31 26 C20 34 6 44 10 46 C18 48 28 36 31 26 Z" fill="' + c[1] + '" stroke="#7a0b40" stroke-width="1.5" stroke-linejoin="round"/></g>' +
      '<g class="wing wing--r"><path d="M33 24 C42 2 62 2 60 18 C59 28 46 30 33 24 Z" fill="' + c[0] + '" stroke="#7a0b40" stroke-width="1.5" stroke-linejoin="round"/><path d="M33 26 C44 34 58 44 54 46 C46 48 36 36 33 26 Z" fill="' + c[1] + '" stroke="#7a0b40" stroke-width="1.5" stroke-linejoin="round"/></g>' +
      '<ellipse cx="32" cy="26" rx="2" ry="9" fill="#5c2a44"/></svg>';
    layer.appendChild(b);
  }
  document.body.appendChild(layer);
})();
