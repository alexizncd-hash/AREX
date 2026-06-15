# AREX — Contexto completo del proyecto · v79

## ¿Qué es AREX?
AREX es un sistema operativo de inteligencia personal estilo J.A.R.V.I.S (Iron Man), desplegado como PWA en GitHub Pages. El usuario principal es Alexiz, estudiante universitario con un negocio de frijol mayocoba (medio litro, listo para disposición y reparto). Prioridad de dispositivos: **1° teléfono Android**, 2° computadora, 3° Meta Quest 3S (AR futuro).

**Repo:** `alexizncd-hash/AREX` (GitHub Pages, rama `main` para producción)  
**Rama de desarrollo activa:** `claude/repo-assistance-7Vpbm`  
**config.js:** GITIGNOREADO — contiene API keys reales. Nunca tocar ni commitear.

---

## Stack técnico
- **Frontend:** HTML/CSS/JS vanilla — sin frameworks, sin bundlers
- **app.js** usa `type="module"`; el resto son scripts globales
- **IA:** Groq API (`llama-3.3-70b-versatile`) — streaming habilitado
- **Búsqueda web:** Tavily API (opcional)
- **Base de datos:** Firebase Firestore — sync en tiempo real vía `onSnapshot`
- **Service Worker:** `sw.js` — actualmente **v79**, network-first para shell files
- **Sin npm, sin node_modules**

---

## Módulos activos (dock)
| Módulo | Archivo | Storage key |
|--------|---------|-------------|
| Dashboard | `app.js` | — |
| Chat IA | `app.js` | `arex_sessions`, `arex_history_*` |
| Finanzas | `finanzas.js` + `finanzas-data.js` | `arex_finanzas` |
| Negocio | `negocio.js` | `arex_negocio` |
| Gastos personales | `gastos.js` | `arex_gastos_pers` |
| Metas | `metas.js` | `arex_metas` |
| Tareas | `app.js` | `arex_tareas` |
| Notas | `app.js` | `arex_notas` |
| Proyectos | `proyectos.js` | `arex_proyectos` |
| Agenda | `agenda.js` | `arex_agenda` |
| Hábitos | `habitos.js` | `arex_habitos` |
| Reparto | `reparto.js` | `arex_reparto_routes` |
| Evidencias | `evidencias.js` | `arex_evidencias` |
| Mission Control | `control.js` | `arex_bitacora`, `arex_agentes_estado` |

---

## Motores visuales (post-optimización v79)

### Siempre activos (boot)
- **orb.js** — motor único del orbe principal. WebGL con fallback 2D. Pausa cuando `document.hidden` o `window._orbPaused = true`.
- **holo.js** — tilt 3D en cards, corner brackets, transiciones de módulo, hex grid estático, orb click ripple. Las partículas animadas (`initParticles`) y streams SVG (`initStreams`) están detrás del **MODO CINE** toggle.
- **parallax.js** — gyro/pointer → CSS vars `--ax`/`--ay`. Se activa cuando MODO CINE está ON (via `window.AREXParallax.start()`).

### Lazy-load (no en boot)
- **gesture.js** — se inyecta como script solo cuando el usuario activa el toggle de Gestos en el módulo Visión. **Gestos v2**: 5 gestos únicos (open_hand, fist, pinch, swipe_left, swipe_right), modelComplexity 0, hold 10 frames, sin partículas ni audio, anillo de progreso en dedo índice.
- **neural-orb.js** — se inyecta solo al abrir la pestaña AGENTES en Mission Control.

### Shell SW excluidos (lazy)
`gesture.js` y `neural-orb.js` no están en el SHELL del Service Worker.

---

## Agentes reales (control.js · v79)
- **HERMES** — Lee `arex_finanzas` + `arex_gastos_pers`. Calcula margen, % deuda, gasto más alto del mes, próximos pagos <7 días. Alerta si margen < $500.
- **ATLAS** — Lee `arex_negocio`. Ganancia del mes, ventas hoy, stock bajo (<10 kg). Alerta si hay stock crítico.
- **SENTINEL** — Checks del sistema: localStorage KB, claves huérfanas, versión SW, groqKey, Firebase.
- **SCRIBE** — Lee `arex_notas` + `arex_tareas`. Con groqKey: resumen IA de notas recientes. Sin key: conteo local. Detecta tareas vencidas.

Cada agente crea una tarjeta en `arex_evidencias` y guarda estado en `arex_agentes_estado`.

---

## Sistema de prompts AI
```js
buildSystemBase()          // personalidad + datos de Alexiz
+ buildContextSection()    // contexto personal (proyectos, universidad, metas)
+ buildMemoriaSection()    // memoria permanente
+ buildSessionMemorySection() // resúmenes de sesiones anteriores (auto-generados)
+ buildModuleContext()     // datos en tiempo real de todos los módulos
```

---

## Comandos del chat
`/ayuda` `/limpiar` `/examen` `/resumir` `/exportar` `/notas` `/stats` `/recordar`  
`/contexto` `/config` `/atajos` `/memoria` `/run` `/tarea` `/briefing` `/pomodoro`  
`/buscar` `/hechos` `/semana` `/analizar [gastos|metas]` `/hoy`

---

## Firebase Firestore
- `arexSyncData(lsKey)` — sube cualquier key de localStorage a Firestore
- `initRealtimeSync()` — `onSnapshot` listeners, previene loops con `_rtLastTs` map
- `initFCM()` — Firebase Cloud Messaging para push notifications

---

## Reglas de desarrollo
1. **Nunca tocar `config.js`** ni incluirlo en commits
2. Toda función usada desde HTML exportar como `window.X = X`
3. `app.js` es `type="module"` — el resto son scripts globales
4. Para agregar módulo: archivo `.js` + `.css`, panel `#module-X.module-panel`, botón en dock, dispatch en `jarvis.js`
5. Service Worker: incrementar versión en `sw.js` en cada deploy
6. Firebase sync: llamar `arexSyncData(KEY)` dentro de cada `save*()`
7. Siempre actualizar README.md con cada commit

---

## Contexto personal de Alexiz
- Estudiante universitario en México
- Negocio de frijol mayocoba (medio litro, listo para disposición y reparto)
- Novia: Margaret
- Metas: crecer personal, espiritual, físico, económico y en relaciones
- Dispositivos: teléfono Android (principal), computadora, Meta Quest 3S
- Prefiere entender el "mínimo funcional" antes de profundizar
- Estética favorita: JARVIS / Iron Man
