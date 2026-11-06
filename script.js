const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Interactive background: the grid lights up and ripples around the cursor ---------- */
(function interactiveBackground() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;   // mouse/trackpad only
  const grid = document.querySelector('.bg-grid');
  const cv = document.createElement('canvas');
  cv.className = 'bg-canvas';
  cv.setAttribute('aria-hidden', 'true');
  grid.after(cv);
  const ctx = cv.getContext('2d');

  const GAP = 44;          // matches the background grid size in style.css
  const RADIUS = 190;      // how far the effect reaches from the cursor
  let w = 0, h = 0;
  let target = { x: innerWidth / 2, y: innerHeight / 2 };
  let pos = { ...target };
  let on = 0, onTarget = 0;    // fades in when the cursor is on the page
  let rgb = '45,212,191';
  let running = false;

  function readColor() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace('#', '');
    if (hex.length === 6) rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
    kick();
  }
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kick();
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function frame() {
    pos.x += (target.x - pos.x) * 0.14;
    pos.y += (target.y - pos.y) * 0.14;
    on += (onTarget - on) * 0.08;
    ctx.clearRect(0, 0, w, h);

    if (on > 0.01) {
      // Soft light under the cursor
      const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, RADIUS * 1.8);
      g.addColorStop(0, `rgba(${rgb},${0.09 * on})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Grid points near the cursor light up and get pushed outward
      const x0 = Math.floor((pos.x - RADIUS) / GAP) * GAP, x1 = pos.x + RADIUS;
      const y0 = Math.floor((pos.y - RADIUS) / GAP) * GAP, y1 = pos.y + RADIUS;
      for (let x = x0; x <= x1; x += GAP) {
        for (let y = y0; y <= y1; y += GAP) {
          const dx = x - pos.x, dy = y - pos.y, d = Math.hypot(dx, dy);
          const t = 1 - d / RADIUS;
          if (t <= 0) continue;
          const push = reduceMotion ? 0 : t * t * 16;
          const px = x + (d ? dx / d : 0) * push, py = y + (d ? dy / d : 0) * push;
          // little plus sign at each grid crossing
          const s = 2 + t * 4;
          ctx.strokeStyle = `rgba(${rgb},${t * 0.85 * on})`;
          ctx.lineWidth = 1 + t;
          ctx.beginPath();
          ctx.moveTo(px - s, py); ctx.lineTo(px + s, py);
          ctx.moveTo(px, py - s); ctx.lineTo(px, py + s);
          ctx.stroke();
        }
      }
    }

    const settled = Math.abs(target.x - pos.x) < 0.3 && Math.abs(target.y - pos.y) < 0.3 && Math.abs(onTarget - on) < 0.01;
    if (settled) { running = false; return; }
    requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (e) => { target.x = e.clientX; target.y = e.clientY; onTarget = 1; kick(); }, { passive: true });
  document.addEventListener('mouseleave', () => { onTarget = 0; kick(); });
  window.addEventListener('blur', () => { onTarget = 0; kick(); });
  window.addEventListener('resize', resize);
  // Re-read the color when the Dark / Color button is pressed
  document.querySelector('.theme-toggle').addEventListener('click', () => setTimeout(readColor, 0));

  resize();
  readColor();
})();

/* ---------- Welcome screen (shows once per visit) ---------- */
(function intro() {
  const el = document.querySelector('.intro');
  let seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
  if (reduceMotion || seen) { el.remove(); return; }
  document.body.classList.add('intro-on');
  const finish = () => {
    el.classList.add('done');
    document.body.classList.remove('intro-on');
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    setTimeout(() => el.remove(), 800);
  };
  const timer = setTimeout(finish, 2600);
  el.addEventListener('click', () => { clearTimeout(timer); finish(); });
})();

/* ---------- Typing effect ---------- */
(function typing() {
  const target = document.querySelector('.typed');
  const words = ['BSIT student', 'Software developer', 'Capstone lead developer'];
  if (reduceMotion) { target.textContent = words[0]; return; }
  let w = 0, i = 0, deleting = false;
  function tick() {
    const word = words[w];
    i += deleting ? -1 : 1;
    target.textContent = word.slice(0, i);
    let delay = deleting ? 45 : 90;
    if (!deleting && i === word.length) { deleting = true; delay = 1600; }
    else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
    setTimeout(tick, delay);
  }
  setTimeout(tick, 900);
})();

/* ---------- Hanging ID card: drag it, tap to flip it, tilt your phone and it follows gravity ---------- */
(function lanyard() {
  const box = document.querySelector('.lanyard');
  const swing = document.querySelector('.swing');
  const strap = document.querySelector('.strap');
  const card = document.querySelector('.card');
  const front = document.querySelector('.card-front');
  const back = document.querySelector('.card-back');
  const hint = document.querySelector('.drag-hint');
  const BASE = strap.offsetHeight;          // normal strap length (px)
  const MAX_STRETCH = 240;                  // how far it can be pulled
  const MAX_TILT = 60;                      // furthest the card will lean when the phone is tilted
  const TAP_MOVE = 6;                       // px a press can move and still count as a tap
  const TAP_TIME = 350;                     // ms a press can last and still count as a tap

  let angle = reduceMotion ? 0 : 12;        // swing angle in degrees
  let angleVel = 0;
  let len = BASE;                           // current strap length
  let lenVel = 0;
  let pressed = false;                      // finger/mouse is down on the card or strap
  let dragging = false;                     // moved far enough to count as a drag
  let down = { x: 0, y: 0, t: 0, onCard: false };
  let grabOffset = 0;                       // distance from strap end to the grab point
  let last = performance.now();
  let prev = { angle: 0, len: 0, t: 0 };

  // Flip
  let flipped = false;
  let flip = 0, flipVel = 0;                // current flip angle (0 = front, 180 = back)

  // Gravity from the phone's tilt sensor
  let gravAngle = 0;                        // where "down" is, in degrees (0 = straight down the screen)
  let gravPull = 1;                         // 0..1, weak when the phone is lying flat
  let gyroOn = false;

  // Top of the strap (the fixed point everything hangs from)
  function anchor() {
    const r = box.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  }
  function draw() {
    const tilt = Math.max(-25, Math.min(25, angleVel * 0.4));
    strap.style.height = len + 'px';
    swing.style.transform = `rotate(${angle}deg)`;
    card.style.transform = `rotateY(${flip + tilt}deg)`;
  }
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (!dragging) {
      // Pendulum swings toward wherever gravity points
      const k = 20 * (gyroOn ? Math.max(0.2, gravPull) : 1);
      angleVel += (-k * (angle - gravAngle) - 1.6 * angleVel) * dt;
      angle += angleVel * dt;
      // Elastic strap snaps back to its normal length
      lenVel += (-140 * (len - BASE) - 9 * lenVel) * dt;
      len += lenVel * dt;
    }
    // Flip with a small bounce at the end
    flipVel += (-110 * (flip - (flipped ? 180 : 0)) - 13 * flipVel) * dt;
    flip += flipVel * dt;
    draw();
    requestAnimationFrame(loop);
  }

  function toggleFlip() {
    flipped = !flipped;
    front.setAttribute('aria-hidden', flipped);
    back.setAttribute('aria-hidden', !flipped);
    if (reduceMotion) { flip = flipped ? 180 : 0; draw(); }
    else angleVel += flipped ? 25 : -25;     // a little swing from the tap
  }

  function pointerInfo(e) {
    const a = anchor();
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    return {
      deg: -Math.atan2(dx, dy) * 180 / Math.PI,
      dist: Math.hypot(dx, dy)
    };
  }

  function start(e) {
    e.preventDefault();
    pressed = true;
    dragging = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), onCard: e.currentTarget === card };
    grabOffset = pointerInfo(e).dist - len;
    prev = { angle, len, t: performance.now() };
  }
  function move(e) {
    if (!pressed) return;
    if (!dragging) {
      // Only start dragging once the pointer has really moved, so taps stay taps
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE) return;
      dragging = true;
      box.classList.add('pulling');
    }
    const p = pointerInfo(e);
    angle = Math.max(-35, Math.min(35, p.deg));
    // Pulling further than the strap's length stretches it, with resistance
    const raw = p.dist - grabOffset;
    if (raw > BASE) {
      const extra = raw - BASE;
      len = BASE + MAX_STRETCH * (1 - Math.exp(-extra / MAX_STRETCH));
    } else {
      len = Math.max(BASE * 0.85, raw);
    }
    const now = performance.now(), dt = Math.max(0.016, (now - prev.t) / 1000);
    angleVel = (angle - prev.angle) / dt;
    lenVel = (len - prev.len) / dt;
    prev = { angle, len, t: now };
    if (reduceMotion) draw();
  }
  function end(e) {
    if (!pressed) return;
    pressed = false;
    if (!dragging) {
      // A quick press on the card without moving = flip it
      if (e.type === 'pointerup' && down.onCard && performance.now() - down.t < TAP_TIME) toggleFlip();
      return;
    }
    dragging = false;
    box.classList.remove('pulling');
    if (reduceMotion) { angle = 0; len = BASE; draw(); }
  }

  [card, strap].forEach(el => {
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
  // Keyboard: Enter or Space flips the card
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFlip(); }
  });

  /* --- Tilt / gravity (phones and tablets) --- */
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  hint.textContent = touchDevice ? 'tap to flip · drag me' : 'click to flip · drag me';

  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
    // Direction of gravity across the screen, in portrait coordinates (x right, y down)
    const sx = Math.cos(b) * Math.sin(g);
    const sy = Math.sin(b);
    // Turn it to match the current screen rotation (landscape support)
    const screenAngle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    const r = -screenAngle * Math.PI / 180;
    const x = sx * Math.cos(r) - sy * Math.sin(r);
    const y = sx * Math.sin(r) + sy * Math.cos(r);
    const target = Math.max(-MAX_TILT, Math.min(MAX_TILT, Math.atan2(-x, y) * 180 / Math.PI));
    gravAngle += (target - gravAngle) * 0.25;   // smooth out sensor jitter
    gravPull = Math.min(1, Math.hypot(x, y));
    if (!gyroOn) { gyroOn = true; hint.textContent = 'tap to flip · tilt or drag'; }
  }
  function startGyro() { window.addEventListener('deviceorientation', onOrient); }

  if (!reduceMotion && touchDevice && 'DeviceOrientationEvent' in window) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iPhone/iPad: motion access must be allowed from a tap (the first tap on the card asks)
      const ask = () => {
        card.removeEventListener('pointerup', ask);
        strap.removeEventListener('pointerup', ask);
        DeviceOrientationEvent.requestPermission()
          .then(res => { if (res === 'granted') startGyro(); })
          .catch(() => {});
      };
      card.addEventListener('pointerup', ask);
      strap.addEventListener('pointerup', ask);
    } else {
      startGyro();   // Android: works right away
    }
  }

  if (reduceMotion) draw(); else requestAnimationFrame(loop);
})();

/* ---------- Nav highlight ---------- */
(function scrolling() {
  const links = [...document.querySelectorAll('.nav ul a')];
  const byId = Object.fromEntries(links.map(a => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && byId[entry.target.id]) {
        links.forEach(a => a.classList.remove('active'));
        byId[entry.target.id].classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(byId).forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });
})();

/* ---------- Scroll reveal ---------- */
(function reveal() {
  const items = [...document.querySelectorAll('[data-reveal]')];
  if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('shown')); return; }
  // Items that sit side by side come in one after another
  items.forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal'));
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', `${i * 120}ms`);
  });
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('shown'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => obs.observe(el));
})();

/* ---------- Hover glow follows the cursor ---------- */
document.querySelectorAll('.glow').forEach(el => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

/* ---------- Tabs ---------- */
const tabs = [...document.querySelectorAll('[role="tab"]')];
const pill = document.querySelector('.tab-pill');
function selectTab(name, focus) {
  tabs.forEach((t, i) => {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on) { pill.style.transform = `translateX(${i * 100}%)`; if (focus) t.focus(); }
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t.dataset.tab));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next.dataset.tab, true);
  });
});

/* ---------- Project details ---------- */
document.querySelectorAll('.details').forEach(btn => {
  btn.addEventListener('click', () => document.getElementById('modal-' + btn.dataset.project).showModal());
});
document.querySelectorAll('.modal').forEach(m => {
  m.querySelector('.modal-close').addEventListener('click', () => m.close());
  m.addEventListener('click', (e) => { if (e.target === m) m.close(); });  // click outside to close
});

/* ---------- Contact form: opens the visitor's email app ---------- */
document.querySelector('.contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target, error = f.querySelector('.form-error');
  const name = f.name.value.trim(), subject = f.subject.value.trim(), message = f.message.value.trim();
  if (!name || !subject || !message) { error.textContent = 'Fill in your name, a subject, and a message.'; return; }
  error.textContent = '';
  const body = `${message}\n\n${name}`;
  window.location.href = `mailto:marklennazuelo123@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

/* ---------- Footer year ---------- */
document.querySelector('.year').textContent = new Date().getFullYear();

/* ---------- Dark mode / color mode toggle ---------- */
(function themeToggle() {
  const root = document.documentElement;
  const btn = document.querySelector('.theme-toggle');
  function sync() {
    const dark = root.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', dark);
    btn.setAttribute('aria-label', dark ? 'Switch to color mode' : 'Switch to dark mode');
  }
  btn.addEventListener('click', () => {
    const dark = root.getAttribute('data-theme') !== 'dark';
    if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', dark ? 'dark' : 'color'); } catch (e) {}
    sync();
  });
  sync();
})();