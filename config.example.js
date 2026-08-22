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
  owmKey:    '',                  // openweathermap.org  (opcional — widget de clima)
  tomtomKey: '',                  // developer.tomtom.com (opcional — TRÁFICO en el mapa
                                  //   de Reparto. 2.500 consultas al día gratis. Sin
                                  //   esta clave el botón de tráfico ni aparece: no
                                  //   existe ninguna fuente de tráfico abierta.)
  firebase: {                     // console.firebase.google.com  (opcional)
    apiKey:            'AIza...',
    authDomain:        'tu-proyecto.firebaseapp.com',
    projectId:         'tu-proyecto',
    storageBucket:     'tu-proyecto.appspot.com',
    messagingSenderId: '123456789',
    appId:             '1:123456789:web:abc123'
  }
};
