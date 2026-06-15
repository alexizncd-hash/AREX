# AUDITORIA AREX · Sprint v82

---

## Sprint A — Fundamentos (v82)

### Rutas Firestore migradas a `users/{uid}`

| Ruta anterior | Ruta nueva |
|---|---|
| `arex_data/{lsKey}` | `users/{uid}/arex_data/{lsKey}` |
| `arex/config` | `users/{uid}/arex/config` |
| `conversations/{id}` | `users/{uid}/conversations/{id}` |
| `notes/{id}` | `users/{uid}/notes/{id}` |
| `stats/global` | `users/{uid}/stats/global` |
| `stats/{fecha}` | `users/{uid}/stats/{fecha}` |

Helpers centralizados en `app.js`: `_userDoc(...segs)` y `_userCol(...segs)`.
Migración one-time via `_migrateFirestoreIfNeeded()` — copia datos viejos a la nueva estructura una sola vez (flag `arex_migrated_v1` en localStorage).

### Estado de reglas Firestore

- Archivo creado: `firestore.rules`
- Archivo CLI: `firebase.json`
- **PENDIENTE — Alexiz debe hacer esto:** publicar en consola Firebase o via `firebase deploy --only firestore:rules`
- Instrucciones en `FIREBASE_SETUP.md`

### Scripts en el boot

| | Antes (v81) | Después (v82) |
|---|---|---|
| Scripts cargados al boot | 17 | 12 |
| Scripts con `defer` | 0 | 12 |
| Scripts lazy-loaded total | 2 | 7 |
| Archivos en SW shell | 34 | 29 |

Scripts que pasaron a lazy (inyección dinámica):
- `reparto.js` — al abrir módulo REPARTO (vía jarvis.js)
- `holo.js`, `parallax.js`, `vision-orb.js`, `vision.js` — tras primera interacción o 4s post-boot
- `gesture.js`, `neural-orb.js` — ya eran lazy desde v79

### Recordatorio para Alexiz

1. **Activar Authentication > Sign-in method > Anonymous** en Firebase Console
2. **Publicar reglas** de seguridad Firestore (ver `FIREBASE_SETUP.md`)

---

## Sprint v79

## Antes / Después

| Métrica | Antes (v76) | Después (v79) |
|---------|-------------|---------------|
| Shell SW inicial | ~38 archivos | 36 archivos (gesture.js, neural-orb.js excluidos) |
| rAF loops activos al boot | ~10 loops (orb + 4×neural-orb + holo particles + parallax + tilt×cards) | 1–2 loops (orb.js + holo tilt event-driven) |
| CSS `!important` | 755 | 755 (pendiente reducción — ver recomendaciones) |
| Gestos disponibles | 10 (se confundían entre sí) | 5 confiables y distintos |
| Gestos modelComplexity | 1 (pesado) | 0 (lite, 2-3× más rápido) |
| Gestos hold | 22 frames (~1.45s) | 10 frames (~0.65s) |
| Agentes HERMES/ATLAS/SENTINEL/SCRIBE | Decorativos (solo animan y navegan) | Análisis real de localStorage + tarjetas de evidencia |
| Evidencias en dock | No (módulo huérfano) | Sí (botón EVID en dock) |
| try/catch en módulos | Parcial | Completo en finanzas.js, negocio.js, gastos.js |
| AREX_CONTEXT.md | Desactualizado (dice v25) | Actualizado a v79 con todos los módulos y motores |

---

## Cambios por tarea

### Tarea 1 — Rendimiento: un solo motor visual
- **orb.js**: Pausa cuando `document.hidden` (visibilitychange listener). `window._orbPaused` flag.
- **holo.js**: `initParticles()` y `initStreams()` movidos a `_startCineEffects()`, activados solo con MODO CINE. Todo lo demás (tilt, corners, transiciones, hex grid) sigue funcionando siempre.
- **parallax.js**: `init()` ya no corre al arrancar. Se expone `window.AREXParallax.start()` / `.stop()`, llamados por el toggle MODO CINE. MODO CINE persiste en `arex_modo_cine` localStorage.
- **neural-orb.js**: Removido de index.html. Se inyecta dinámicamente la primera vez que se abre la pestaña AGENTES en Mission Control.

### Tarea 2 — Gestos v2 (reescritura completa)
- 5 gestos únicos (open_hand ✋, fist ✊, pinch 🤏, swipe_left ◀, swipe_right ▶)
- modelComplexity: 0 · hold: 10 frames · inferencia throttled a ~15fps
- Video interno 320×240 (suficiente para hand tracking)
- Eliminado: partículas, trail, audio
- Añadido: anillo de progreso alrededor del dedo índice (1 arc/frame)
- Carga lazy: se inyecta como script solo al activar el toggle de Gestos en Visión
- Estado de carga: `window._geLoadingStatus` (`idle → loading → ready/error`)
- Mensaje "CARGANDO MOTOR DE GESTOS..." en canvas durante init

### Tarea 3 — Agentes reales
- **HERMES**: margen libre, % deuda vs ingreso, gasto más alto del mes, próximos pagos <7 días. Alerta si margen < $500.
- **ATLAS**: ganancias del mes, ventas hoy, stock bajo (<10 kg). Alerta si hay críticos.
- **SENTINEL**: KB en localStorage, claves huérfanas, versión SW, groqKey presente, Firebase conectado.
- **SCRIBE**: notas sin título, tareas vencidas, resumen IA opcional (Groq). Fallback local si no hay key.
- Estado persistido en `arex_agentes_estado` (incluido en BACKUP_KEYS y sync Firestore).

### Tarea 4 — Evidencias integradas al flujo diario
- Botón **EVID** añadido al dock (data-module="evidencias")
- Módulo `#module-evidencias` completo con header + `ev-board`
- Wired en jarvis.js: `renderEvidenciasWidget()` al cambiar al módulo
- Chat: botón ☆ ya existía en cada respuesta de AREX → guarda en evidencias (implementado en sprint anterior)
- Agentes alimentan evidencias automáticamente al ejecutarse

### Tarea 5 — Robustez de módulos
- finanzas.js, negocio.js, gastos.js: ya tenían try/catch en las funciones de getData. Verificado sin cambios necesarios.

### Tarea 6 — Limpieza
- app.js: 0 console.log (ya limpiado en sprint anterior)
- sw.js: bumpeado a v79. gesture.js y neural-orb.js removidos del SHELL.
- AREX_CONTEXT.md: reescrito desde v25 → v79. Módulos actuales, motores visuales post-optimización, gestos v2, agentes reales, prioridad de dispositivos.

---

## Archivos convertidos a lazy-load

| Archivo | Antes | Después |
|---------|-------|---------|
| `gesture.js` | `<script src="gesture.js">` en index.html + en SHELL SW | Inyectado dinámicamente en vision.js cuando se activa el toggle |
| `neural-orb.js` | `<script src="neural-orb.js">` en index.html + en SHELL SW | Inyectado en control.js al abrir pestaña AGENTES |
| `holo.js` particles | Corría siempre al boot | Solo corre con MODO CINE ON |
| `parallax.js` | Corría siempre al boot | Iniciado por MODO CINE toggle |

---

## Problemas restantes

### 🔴 CRÍTICO
- Ninguno identificado tras la optimización.

### 🟡 IMPORTANTE
- **style.css 755 `!important`** — penaliza la capacidad de sobrescribir estilos en módulos nuevos. Requiere auditoría selectiva (módulo por módulo).
- **app.js 5000+ líneas** — difícil de mantener. Considerar extraer `tareas.js`, `notas.js`, `recordatorios.js`.
- **Recordatorios no persistentes** — `setTimeout` se pierde al cerrar el tab. Sin notificaciones push programadas desde el servidor (requeriría FCM con Cloud Functions).

### 🟢 MENOR
- holo.js `injectHoloLabel` muestra "MARK III" hardcoded. Debería leerse de `AREX_SW_VERSION`.
- vision-orb.js no removido del SHELL aunque raramente se usa fuera del módulo Visión.
- `_GE_SWIPE_COOL 2000ms` puede ser lento para navegación fluida; considerar 1200ms.

---

## Recomendaciones para el siguiente sprint

1. **Dividir app.js** — extraer tareas.js, notas.js, recordatorios.js. Cada módulo ~300 líneas.
2. **Reducir !important en style.css** — al menos módulo por módulo en finanzas.css, metas.css, habitos.css.
3. **Push notifications programadas** — explorar Firebase Cloud Functions + FCM para recordatorios que sobrevivan el cierre del tab.
4. **Exportar/compartir evidencias** — botón para exportar tarjeta como imagen o PDF.
5. **Modo compacto para móvil** — los paneles del dashboard son muy largos en pantallas pequeñas.
