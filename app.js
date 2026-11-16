/* =====================================================================
   LOVE AND DEATH: a concrete poem
   ---------------------------------------------------------------------
   The big idea, in code:
   1. Every word of the poem becomes its own element on the page (once).
   2. Each SHAPE is just a function that returns a target spot for every
      word: an x, a y, a rotation and a size.
   3. Switching shapes never adds or removes words. It hands each word a
      new target, and CSS transitions animate it there.
   Same words, different shape, same ending.
   ===================================================================== */
(function () {
'use strict';

// The poem, exactly as written. Do not edit a word.
const TITLE = 'Love and Death';
const POEM = "Sometimes I see myself standing in the midst of the bazaar wondering what's the meaning of life. But then I realized how death was like snow falling in the dark. Cold, and ruthless, it doesn't care about anything. Years ago there was a girl I used to like and I wasn't sure why. I did everything I could to get her to love me back but she only had eyes for Michael. Now as I am getting old, I realize she is too, because at the end snow falls on everyone.";
const WORDS = POEM.split(/\s+/);
// The last line, which breaks off the window frame at the end.
const LAST_LINE = 'because at the end snow falls on everyone.'.split(' ').length;

const CAPTIONS = {
  snow: 'The Dead · it falls on the living and the dead alike',
  lamp: 'Araby · the lamp burns, and then the bazaar goes dark',
  window: 'Both · the boy behind the blind, Gabriel at the hotel window'
};

const $ = id => document.getElementById(id);
const stage = $('stage');
let mode = 'intro';
let timers = [];
let widths = []; // each word's width at a font size of 100px
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------------------------------------------------------------------
   STEP 1: make one element per word.
   --------------------------------------------------------------------- */
const els = WORDS.map((w, i) => {
  const s = document.createElement('span');
  s.className = 'w';
  s.textContent = w;
  s.dataset.i = i;
  stage.appendChild(s);
  return s;
});
$('poemText').textContent = POEM;

/* Measure each word once, so we can work out how big the text can be
   for every shape to fit on any screen. */
function measure() {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '100px "IM Fell English", Georgia, serif';
  widths = WORDS.map(w => c.measureText(w).width);
}

/* Move one word to its target. A target is {x, y, rot, size, dur, delay}. */
function place(el, t) {
  el.style.transitionDuration = (t.dur ?? 1.8) + 's';
  el.style.transitionDelay = (t.delay ?? 0) + 's';
  el.style.fontSize = t.size + 'px';
  el.style.transform = `translate(${t.x}px, ${t.y}px) translate(-50%, -50%) rotate(${t.rot || 0}deg)`;
}

/* The space the shapes can use: the screen minus the buttons at the bottom. */
function area() {
  const W = window.innerWidth, H = window.innerHeight;
  const controls = $('controls').getBoundingClientRect().height;
  const top = 54, bottom = H - controls - 10;
  return { W, H, top, bottom, h: bottom - top, cx: W / 2, cy: (top + bottom) / 2 };
}

/* ---------------------------------------------------------------------
   STEP 2: lay words along a drawn outline.
   This is how the Lamp and the Window work: the outline is a list of
   lines, and the words are spaced along it, in reading order, each one
   turned to follow the line it sits on.
   --------------------------------------------------------------------- */
function alongPath(paths) {
  // Break every outline into straight pieces and measure them.
  const segs = [];
  paths.forEach(pts => { for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > 0.5) segs.push({ a, b, len, ang: Math.atan2(b.y - a.y, b.x - a.x) });
  } });
  const L = segs.reduce((s, g) => s + g.len, 0);

  // Pick the font size that makes all the words just fill the outline.
  const GAP = 0.32; // space between words, as a fraction of the font size
  const per100 = widths.reduce((s, w) => s + w, 0) / 100 + WORDS.length * GAP;
  let size = Math.max(8, Math.min(30, (L * 0.97) / per100));
  const used = size * per100;
  const extra = Math.max(0, (L - used) / WORDS.length); // spread out if words are capped small

  const at = d => { // the point and angle at distance d along the outline
    for (const g of segs) { if (d <= g.len) return { x: g.a.x + (g.b.x - g.a.x) * d / g.len, y: g.a.y + (g.b.y - g.a.y) * d / g.len, ang: g.ang }; d -= g.len; }
    const g = segs[segs.length - 1]; return { x: g.b.x, y: g.b.y, ang: g.ang };
  };

  let d = 0;
  return WORDS.map((w, i) => {
    const wpx = widths[i] * size / 100;
    const p = at(d + wpx / 2);
    let rot = p.ang * 180 / Math.PI;
    if (rot > 95 || rot < -95) rot += 180; // never leave a word upside down
    d += wpx + GAP * size + extra;
    return { x: p.x, y: p.y, rot, size };
  });
}

/* ---------------------------------------------------------------------
   STEP 3: the three shapes.
   --------------------------------------------------------------------- */

/* SNOW (The Dead): the words drift up into the sky, then fall one by one
   and settle in a drift at the bottom, the first words to fall at the
   very bottom. */
function snow() {
  const A = area();
  const size = Math.max(12, Math.min(26, Math.min(A.W, A.h) / 24));
  const space = size * 0.32, lineH = size * 1.35;
  // Build rows from the bottom up, each a little narrower, like a drift.
  const rows = []; let row = [], k = 0, rowW = 0;
  const cap = k => Math.max(A.W * 0.3, A.W * 0.92 * (1 - k * 0.11));
  WORDS.forEach((w, i) => {
    const wpx = widths[i] * size / 100;
    if (row.length && rowW + wpx > cap(k)) { rows.push(row); row = []; rowW = 0; k++; }
    row.push(i); rowW += wpx + space;
  });
  if (row.length) rows.push(row);

  const pile = new Array(WORDS.length);
  rows.forEach((r, k) => {
    const total = r.reduce((s, i) => s + widths[i] * size / 100, 0) + space * (r.length - 1);
    let x = A.cx - total / 2;
    const y = A.bottom - size * 0.8 - k * lineH;
    r.forEach(i => { const wpx = widths[i] * size / 100; pile[i] = { x: x + wpx / 2 + rnd(-2, 2), y: y + rnd(-2, 2), rot: rnd(-6, 6), size }; x += wpx + space; });
  });

  // Phase 1: up into the sky. Phase 2: fall, slowly, in order.
  els.forEach((el, i) => place(el, { x: rnd(A.W * 0.04, A.W * 0.96), y: rnd(A.top - 20, A.top + A.h * 0.28), rot: rnd(-20, 20), size: size * 0.9, dur: 1.4, delay: Math.random() * 0.5 }));
  later(() => els.forEach((el, i) => place(el, { ...pile[i], dur: rnd(3.5, 6), delay: i * 0.11 + rnd(0, 0.4) })), 1900);
}

/* LAMP (Araby): the words trace an old lamp, which glows, and then the
   light slowly goes out, like the bazaar closing. */
function lamp() {
  const A = area();
  // Shape coordinates: x from -0.5 to 0.5 across, y from 0 (top) to 1 (bottom).
  const h = Math.min(A.h * 0.94, A.W * 1.1), w = h * 0.78;
  const X = x => A.cx + x * w, Y = y => A.top + (A.h - h) / 2 + y * h;
  const P = (x, y) => ({ x: X(x), y: Y(y) });
  const handle = [];
  for (let a = 180; a <= 360; a += 15) { const r = a * Math.PI / 180; handle.push(P(Math.cos(r) * 0.11, 0.12 + Math.sin(r) * 0.09)); }
  const outline = [
    ...handle,                       // the ring on top
    P(0.11, 0.12), P(0.42, 0.27),    // roof, right
    P(0.30, 0.30),                   // under the roof
    P(0.36, 0.80),                   // glass, right side (wider at the bottom)
    P(0.45, 0.85), P(0.45, 0.93),    // base, right
    P(-0.45, 0.93), P(-0.45, 0.85),  // base
    P(-0.36, 0.80),
    P(-0.30, 0.30),                  // glass, left side
    P(-0.42, 0.27), P(-0.11, 0.12)   // roof, left, back to the ring
  ];
  // The flame inside the glass, a teardrop: also made of words.
  const flame = [];
  for (let a = 0; a <= 360; a += 20) {
    const r = a * Math.PI / 180, s = Math.sin(r / 2);
    flame.push(P(Math.sin(r) * 0.09 * s, 0.68 - (1 - Math.cos(r)) / 2 * 0.24));
  }
  const t = alongPath([outline, flame]);
  els.forEach((el, i) => place(el, { ...t[i], dur: 2, delay: i * 0.012 }));
  // Let it burn, then let it go out.
  later(() => { document.body.classList.add('dimmed'); caption('The light is out.'); }, 6500);
}

/* WINDOW (both stories): the words build a window with four panes.
   Snow falls outside. Then the last line breaks off the frame and
   drifts down through the glass. */
function windowShape() {
  const A = area();
  const h = A.h * 0.86, w = Math.min(A.W * 0.86, h * 0.95);
  const l = A.cx - w / 2, r = A.cx + w / 2, t = A.cy - h / 2, b = A.cy + h / 2;
  const P = (x, y) => ({ x, y });
  const paths = [
    [P(l, t), P(r, t)],                    // top
    [P(r, t), P(r, b)],                    // right
    [P(l, b), P(r, b)],                    // bottom (left to right, so it reads)
    [P(l, b), P(l, t)],                    // left
    [P(A.cx, t), P(A.cx, b)],              // the cross: down the middle
    [P(l, A.cy), P(r, A.cy)]               // the cross: across
  ];
  const targets = alongPath(paths);
  els.forEach((el, i) => { el.classList.add('frame'); place(el, { ...targets[i], dur: 2, delay: i * 0.012 }); });

  // The last line lets go of the frame and drifts down through the window.
  later(() => {
    const first = WORDS.length - LAST_LINE;
    for (let i = first; i < WORDS.length; i++) {
      const k = i - first;
      els[i].classList.remove('frame'); els[i].classList.add('falling');
      const x = l + w * 0.12 + (w * 0.76) * (k / (LAST_LINE - 1)) + rnd(-10, 10);
      place(els[i], { x, y: b - targets[i].size * (1.4 + (k % 2) * 1.3), rot: rnd(-14, 14), size: targets[i].size * 1.15, dur: rnd(6, 8), delay: k * 0.6 });
    }
    caption('…snow falls on everyone.');
  }, 5200);
}

/* Before anything is chosen: the words float faintly, scattered. */
function scatter() {
  const A = area();
  els.forEach(el => place(el, { x: rnd(A.W * 0.05, A.W * 0.95), y: rnd(A.top, A.bottom), rot: rnd(-25, 25), size: rnd(12, 22), dur: 2 }));
}

/* ---------------------------------------------------------------------
   Switching shapes
   --------------------------------------------------------------------- */
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function caption(text) { const c = $('caption'); c.classList.remove('on'); later(() => { c.textContent = text; c.classList.add('on'); }, 300); }

function show(next) {
  timers.forEach(clearTimeout); timers = [];
  document.body.classList.remove('dimmed');
  els.forEach(el => el.classList.remove('frame', 'falling'));
  mode = next;
  document.body.dataset.mode = next;
  document.querySelectorAll('[data-shape]').forEach(b => b.classList.toggle('on', b.dataset.shape === next));
  if (next === 'snow') snow();
  else if (next === 'lamp') lamp();
  else if (next === 'window') windowShape();
  else scatter();
  if (CAPTIONS[next]) caption(CAPTIONS[next]);
}

document.querySelectorAll('[data-shape]').forEach(b => b.addEventListener('click', () => show(b.dataset.shape)));

/* On resize, rebuild the current shape for the new screen size. */
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => show(mode), 250); });

/* ---------------------------------------------------------------------
   Read the poem / Reflection panels
   --------------------------------------------------------------------- */
const open = id => { $(id).hidden = false; };
const closeAll = () => document.querySelectorAll('.panel').forEach(p => p.hidden = true);
$('readBtn').onclick = () => open('readPanel');
$('aboutBtn').onclick = () => open('aboutPanel');
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAll);
document.querySelectorAll('.panel').forEach(p => p.addEventListener('click', e => { if (e.target === p) closeAll(); }));
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

/* ---------------------------------------------------------------------
   Background snow (drawn on a canvas behind the words)
   --------------------------------------------------------------------- */
const cv = $('snow'), cx = cv.getContext('2d');
let flakes = [];
function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  flakes = Array.from({ length: Math.round(innerWidth * innerHeight / 9000) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: rnd(0.4, 2), s: rnd(0.2, 0.8), d: Math.random() * 6 }));
}
function drawSnow() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  cx.fillStyle = 'rgba(230,238,248,0.7)';
  const speed = mode === 'window' ? 1.25 : 1;
  for (const f of flakes) {
    f.y += f.s * speed; f.d += 0.01; f.x += Math.sin(f.d) * 0.3;
    if (f.y > innerHeight) { f.y = -4; f.x = Math.random() * innerWidth; }
    cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, Math.PI * 2); cx.fill();
  }
  requestAnimationFrame(drawSnow);
}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { sizeCanvas(); addEventListener('resize', sizeCanvas); drawSnow(); }

/* ---------------------------------------------------------------------
   Optional sound: a soft winter wind, made in the browser (no files).
   Off until you turn it on.
   --------------------------------------------------------------------- */
let audio = null;
function startWind() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; } // soft "brown" noise
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
  const gain = ctx.createGain(); gain.gain.value = 0;
  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.07; lfoGain.gain.value = 0.025;
  lfo.connect(lfoGain).connect(gain.gain);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(); lfo.start();
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
  return { ctx, gain };
}
$('soundBtn').onclick = () => {
  const btn = $('soundBtn');
  if (!audio) { audio = startWind(); btn.textContent = 'Sound: on'; btn.setAttribute('aria-pressed', 'true'); return; }
  if (audio.ctx.state === 'running') { audio.ctx.suspend(); btn.textContent = 'Sound: off'; btn.setAttribute('aria-pressed', 'false'); }
  else { audio.ctx.resume(); btn.textContent = 'Sound: on'; btn.setAttribute('aria-pressed', 'true'); }
};

/* ---------------------------------------------------------------------
   Start: wait for the old-fashioned font, measure, then scatter.
   --------------------------------------------------------------------- */
(document.fonts ? document.fonts.load('100px "IM Fell English"') : Promise.resolve()).catch(() => {}).then(() => {
  measure();
  show('intro');
});
})();
