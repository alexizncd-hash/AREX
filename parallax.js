// AREX — Parallax Engine
// Gyroscope (móvil) + pointer (escritorio) → variables CSS --ax / --ay (-1..1)
// Da profundidad holográfica a paneles HUD, orbe y reactor.

(function () {
  'use strict';

  const root = document.documentElement;
  let tx = 0, ty = 0;      // target tilt
  let cx = 0, cy = 0;      // current (smoothed)
  let rafPending = false;
  let active = false;

  const MAX = 1;           // clamp range
  const EASE = 0.12;       // smoothing factor

  function _apply() {
    rafPending = false;
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;
    root.style.setProperty('--ax', cx.toFixed(3));
    root.style.setProperty('--ay', cy.toFixed(3));
    if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) _schedule();
  }

  function _schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(_apply);
  }

  function _set(nx, ny) {
    tx = Math.max(-MAX, Math.min(MAX, nx));
    ty = Math.max(-MAX, Math.min(MAX, ny));
    _schedule();
  }

  /* ── Pointer (escritorio) ──────────────────────────── */
  function _onPointer(e) {
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    _set((e.clientX / w - 0.5) * 2, (e.clientY / h - 0.5) * 2);
  }

  /* ── Giroscopio (móvil) ────────────────────────────── */
  function _onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    // gamma: izq/der (-90..90), beta: arriba/abajo (-180..180)
    _set(Math.max(-30, Math.min(30, e.gamma)) / 30,
         Math.max(-30, Math.min(30, e.beta - 45)) / 30);
  }

  function _enableGyro() {
    window.addEventListener('deviceorientation', _onOrient, { passive: true });
    active = true;
  }

  /* ── Init: prioriza gyro en móvil, pointer en desktop ── */
  function init() {
    const isTouch = matchMedia('(pointer: coarse)').matches;
    if (isTouch && typeof DeviceOrientationEvent !== 'undefined') {
      // iOS 13+ requiere permiso tras gesto del usuario
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const ask = () => {
          DeviceOrientationEvent.requestPermission()
            .then(state => { if (state === 'granted') _enableGyro(); })
            .catch(() => {});
          window.removeEventListener('touchend', ask);
        };
        window.addEventListener('touchend', ask, { once: true });
      } else {
        _enableGyro();
      }
    } else {
      window.addEventListener('pointermove', _onPointer, { passive: true });
      active = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AREXParallax = { isActive: () => active };
})();
