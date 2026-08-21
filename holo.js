/* ═══════════════════════════════════════════════════════════
   AREX HOLO ENGINE v51 — Tony Stark / JARVIS Interface
   Interactive 3D holographic layer — purely additive, no deps
   ═══════════════════════════════════════════════════════════ */
(function holoEngine() {
  'use strict';

  /* ── 1. REJILLA HEXAGONAL — RETIRADA (v215) ───────────────
     Creaba un canvas de 390×844 (0,33 Mpx) pegado al fondo del body para
     dibujar hexágonos a rgba(0,212,255,0.065) — una trama que sobre el
     fondo #01060d prácticamente no se distingue. No animaba, pero se
     quedaba residente en memoria de GPU y se redibujaba en cada resize
     (y en el móvil un resize ocurre cada vez que aparece el teclado).
     Si se quiere el efecto, un background-image CSS repetido cuesta cero. */

  /* ── 2. AMBIENT PARTICLE FIELD ──────────────────────────── */
  function initParticles() {
    if (document.getElementById('holo-particles-cv')) return; // already running
    const cv = document.createElement('canvas');
    cv.id = 'holo-particles-cv';
    document.body.appendChild(cv);

    let W = window.innerWidth, H = window.innerHeight;
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
      r: Math.random() * 1.4 + .4, ph: Math.random() * Math.PI * 2,
    }));

    function frame(ts) {
      if (!_cineParticlesActive) { cv.remove(); return; }
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x = (p.x + p.vx + W) % W;
        p.y = (p.y + p.vy + H) % H;
        const a = (.18 + .12 * Math.sin(ts * .0008 + p.ph));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${a.toFixed(3)})`;
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', () => { W = window.innerWidth; H = window.innerHeight; });
    requestAnimationFrame(frame);
  }

  /* ── 3. TILT 3D EN LAS TARJETAS — RETIRADO (v215) ─────────
     Enganchaba mouseenter/mousemove/mouseleave a 21 clases de tarjeta para
     inclinarlas en perspectiva siguiendo el cursor. Dos problemas:
       · AREX se usa en iPhone y en Quest. Ahí NO HAY CURSOR, así que el
         efecto no se veía nunca y solo dejaba los oyentes puestos.
       · Se mantenía al día con un MutationObserver sobre
         document.documentElement con subtree:true — es decir, CADA cambio
         del DOM en cualquier módulo relanzaba un recorrido de 21
         querySelectorAll sobre el documento entero. Cada render de una
         lista de tareas o de ventas disparaba ese barrido.
     Era el coste oculto más caro del sistema: no se veía en el perfil de
     pintado porque no dibuja nada, solo quema CPU en JavaScript. */
  function tiltAll() {}   // se conserva el nombre: initTransitions() lo llama

  /* ── 4. DRAGGABLE FLOATING HUD PANELS ───────────────────── */
  function makeDraggable(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const hdr = el.querySelector('.hud-ph');
    if (!hdr) return;

    const btn = document.createElement('button');
    btn.className = 'holo-float-btn';
    btn.textContent = '⊞';
    btn.title = 'Flotar / anclar';
    hdr.appendChild(btn);

    let floating = false, dragging = false, ox = 0, oy = 0, sl = 0, st = 0;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      floating = !floating;
      if (floating) {
        const r = el.getBoundingClientRect();
        Object.assign(el.style, {
          position: 'fixed', left: r.left + 'px', top: r.top + 'px',
          width: r.width + 'px', zIndex: '900',
        });
        el.classList.add('holo-floating');
        btn.textContent = '⊟';
        typeof logBitacora === 'function' && logBitacora('sistema', `Panel ${id} flotando`);
      } else {
        Object.assign(el.style, { position: '', left: '', top: '', width: '', zIndex: '' });
        el.classList.remove('holo-floating');
        btn.textContent = '⊞';
      }
    });

    hdr.style.cursor = 'grab';

    hdr.addEventListener('mousedown', e => {
      if (!floating || e.target === btn) return;
      dragging = true;
      ox = e.clientX; oy = e.clientY;
      sl = parseInt(el.style.left) || 0;
      st = parseInt(el.style.top)  || 0;
      hdr.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      el.style.left = (sl + e.clientX - ox) + 'px';
      el.style.top  = (st + e.clientY - oy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      hdr.style.cursor = 'grab';
    });
  }

  /* ── 5. HOLOGRAPHIC MODULE TRANSITIONS ──────────────────── */
  function initTransitions() {
    if (!window.AREXNav?.cambiarModulo) return;
    const orig = AREXNav.cambiarModulo.bind(AREXNav);
    AREXNav.cambiarModulo = mod => {
      const curr = document.querySelector('.module-panel.active');
      if (curr) {
        curr.style.transition = 'transform .2s ease, opacity .2s ease, filter .2s ease';
        curr.style.transform  = 'perspective(1100px) rotateX(-5deg) scale(.97)';
        curr.style.opacity    = '0';
        curr.style.filter     = 'blur(4px) brightness(1.5)';
      }
      setTimeout(() => {
        orig(mod);
        const next = document.getElementById('module-' + mod);
        if (!next) return;
        next.style.transition = 'none';
        next.style.transform  = 'perspective(1100px) rotateX(7deg) translateY(22px) scale(.97)';
        next.style.opacity    = '0';
        next.style.filter     = 'blur(3px) brightness(1.7)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          next.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1), opacity .42s ease, filter .42s ease';
          next.style.transform  = next.style.opacity = next.style.filter = '';
          setTimeout(() => { next.style.transition = ''; tiltAll(); }, 530);
        }));
        scanReveal(next);
      }, 170);
    };
  }

  /* ── 6. SCAN REVEAL LINE ────────────────────────────────── */
  function scanReveal(el) {
    const line = document.createElement('div');
    line.style.cssText = [
      'position:absolute', 'inset-inline:0', 'left:0', 'right:0', 'top:0', 'height:3px',
      'background:linear-gradient(90deg,transparent 0%,rgba(0,212,255,.95) 40%,rgba(255,255,255,.7) 50%,rgba(0,212,255,.95) 60%,transparent 100%)',
      'box-shadow:0 0 22px rgba(0,212,255,.7),0 0 55px rgba(0,212,255,.3)',
      'pointer-events:none', 'z-index:1000',
      'transition:top .48s cubic-bezier(.25,.1,.25,1)',
    ].join(';');
    const was = getComputedStyle(el).position;
    if (was === 'static') el.style.position = 'relative';
    el.appendChild(line);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      line.style.top = '100%';
      setTimeout(() => {
        line.remove();
        if (was === 'static') el.style.position = '';
      }, 500);
    }));
  }

  /* ── 7. SVG DATA STREAMS (orb → panels) ─────────────────── */
  function initStreams() {
    const NS  = 'http://www.w3.org/2000/svg';
    const XNS = 'http://www.w3.org/1999/xlink';
    const svg = document.createElementNS(NS, 'svg');
    svg.id = 'holo-svg-streams';
    Object.assign(svg.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      zIndex: '1', width: '100%', height: '100%', overflow: 'visible',
    });
    document.body.appendChild(svg);

    const STREAMS = [
      { id: 'hp-tareas',   side: 'r', col: 'rgba(0,212,255,.6)',  col2: 'rgba(0,212,255,.25)', dur: 3.0 },
      { id: 'hp-finanzas', side: 'l', col: 'rgba(0,255,170,.55)', col2: 'rgba(0,255,170,.22)', dur: 4.2 },
    ];

    function mkPath(id, d, stroke) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('id',    id);
      p.setAttribute('d',     d);
      p.setAttribute('fill',  'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', '1');
      p.setAttribute('stroke-dasharray', '4 9');
      return p;
    }

    function mkDot(r, fill, dur, pid, begin) {
      const c  = document.createElementNS(NS, 'circle');
      c.setAttribute('r', r); c.setAttribute('fill', fill);
      const am = document.createElementNS(NS, 'animateMotion');
      am.setAttribute('dur', dur + 's');
      am.setAttribute('repeatCount', 'indefinite');
      if (begin) am.setAttribute('begin', begin);
      const mp = document.createElementNS(NS, 'mpath');
      mp.setAttributeNS(XNS, 'href', '#' + pid);
      am.appendChild(mp); c.appendChild(am);
      return c;
    }

    function update() {
      const orb = document.getElementById('orb');
      if (!orb) return;
      svg.innerHTML = '';
      const or = orb.getBoundingClientRect();
      const cx = or.left + or.width  / 2;
      const cy = or.top  + or.height / 2;

      STREAMS.forEach(({ id, side, col, col2, dur }, i) => {
        const panel = document.getElementById(id);
        if (!panel || panel.classList.contains('holo-floating')) return;
        const pr = panel.getBoundingClientRect();
        if (!pr.width) return;
        const px  = side === 'r' ? pr.right : pr.left;
        const py  = pr.top + pr.height / 2;
        const mid = (cx + px) / 2;
        const pid = 'hs' + i;
        const d   = `M${cx},${cy} C${mid},${cy} ${mid},${py} ${px},${py}`;
        const lineCol = col.replace('.6)', '.1)').replace('.55)', '.08)');
        svg.appendChild(mkPath(pid, d, lineCol));
        svg.appendChild(mkDot(2.8, col,  dur,        pid, null));
        svg.appendChild(mkDot(1.6, col2, dur,        pid, (dur * .45) + 's'));
        svg.appendChild(mkDot(1.2, col2, dur * .7,   pid, (dur * .2)  + 's'));
      });
    }

    setTimeout(update, 1400);
    window.addEventListener('resize', () => setTimeout(update, 150));
    window._holoUpdateTimer = setInterval(update, 12000);
  }

  /* ── 8. ORB CLICK — MULTI-RIPPLE ────────────────────────── */
  function initOrbClick() {
    const orb = document.getElementById('orb');
    if (!orb) return;
    const stage = orb.closest('.orb-stage') || orb.parentElement;
    orb.style.cursor = 'pointer';
    orb.addEventListener('click', () => {
      [0, 110, 220].forEach(delay => {
        setTimeout(() => {
          const r = document.createElement('div');
          r.className = 'holo-orb-ripple';
          stage.appendChild(r);
          r.addEventListener('animationend', () => r.remove());
        }, delay);
      });
    });
  }

  /* ── 9. HOLOGRAPHIC STATUS BADGE (top-right orb) ───────── */
  function injectHoloLabel() {
    const rw = document.querySelector('.reactor-wrap');
    if (!rw || document.getElementById('holo-sys-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'holo-sys-badge';
    badge.innerHTML = `
      <span class="hsb-dot"></span>
      <span class="hsb-text">AREX · MARK III</span>
      <span class="hsb-ver">v57</span>`;
    rw.appendChild(badge);
  }

  /* ── 11. ESQUINAS INYECTADAS — RETIRADAS (v215) ───────────
     Recorría .hud-panel, .dash-widget, .diag-quad y .holo-floating y le
     metía a cada uno SEIS nodos: cuatro <span> de esquina, una línea de
     brillo superior y una capa de barrido. En una pantalla con ocho paneles
     son 48 elementos de adorno puro, creados desde JavaScript después de
     cada render. Las tarjetas que de verdad quieren esquinas ya las traen
     en su propio CSS. */
  function injectCorners() {}   // se conserva el nombre: init() lo llama

  /* ── 10. HOLO MODE TOGGLE BUTTON ────────────────────────── */
  function injectHoloModeBtn() {
    const hdr = document.querySelector('.hdr-right');
    if (!hdr || document.getElementById('btn-holo-mode')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-holo-mode';
    btn.className = 'btn-hdr-icon holo-mode-btn';
    btn.title = 'Modo HOLO — 3D intenso';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`;
    hdr.insertBefore(btn, hdr.firstChild);
    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('holo-mode');
      btn.classList.toggle('active', on);
      localStorage.setItem('arex_modo_cine', on ? '1' : '0');
      if (on) _startCineEffects();
      else    _stopCineEffects();
      typeof logBitacora === 'function' && logBitacora('sistema', 'Modo CINE ' + (on ? 'ON' : 'OFF'));
    });
  }

  /* ── CINE effects (opt-in) ─────────────────────────────── */
  let _cineParticlesActive = false;

  function _startCineEffects() {
    if (!_cineParticlesActive) { _cineParticlesActive = true; initParticles(); }
    initStreams();
    window.AREXParallax?.start?.();
  }

  function _stopCineEffects() {
    _cineParticlesActive = false;
    window.AREXParallax?.stop?.();
  }

  /* ── INIT ───────────────────────────────────────────────── */
  function init() {
    /* v215 · initHexGrid() y tiltAll() retirados.
       El tilt en perspectiva enganchaba mousemove a 21 clases de tarjeta de
       toda la app: en el iPhone y en el Quest no hay ratón, así que era peso
       muerto que además obligaba a recorrer el árbol tras cada render. */
    makeDraggable('hp-tareas');
    makeDraggable('hp-finanzas');
    injectHoloLabel();
    injectHoloModeBtn();
    setTimeout(initTransitions, 700);
    setTimeout(initOrbClick, 500);
    setTimeout(injectCorners, 600);
    /* v215 · El MutationObserver vigilaba el subárbol COMPLETO del dock y
       relanzaba injectCorners() en cada cambio. Los botones del dock son
       fijos: basta con inyectar las esquinas una vez. */
    // Restore MODO CINE if previously enabled
    if (localStorage.getItem('arex_modo_cine') === '1') {
      setTimeout(() => {
        document.body.classList.add('holo-mode');
        document.getElementById('btn-holo-mode')?.classList.add('active');
        _startCineEffects();
      }, 800);
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : setTimeout(init, 0);

})();
