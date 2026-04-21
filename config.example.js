// ─────────────────────────────────────────────────────────
//  AREX — Configuración local
//  Copia este archivo como "config.js" y llena con tus keys.
//  config.js está en .gitignore — nunca se sube al repositorio.
//
//  IMPORTANTE: usa window.AREX_CONFIG (no const) para que
//  el módulo ES de app.js pueda acceder a la variable.
// ─────────────────────────────────────────────────────────

window.AREX_CONFIG = {
  groqKey:   'gsk_...',           // console.groq.com
  tavilyKey: 'tvly-...',          // app.tavily.com  (opcional)
  firebase: {                     // console.firebase.google.com  (opcional)
    apiKey:            'AIza...',
    authDomain:        'tu-proyecto.firebaseapp.com',
    projectId:         'tu-proyecto',
    storageBucket:     'tu-proyecto.appspot.com',
    messagingSenderId: '123456789',
    appId:             '1:123456789:web:abc123'
  }
};
