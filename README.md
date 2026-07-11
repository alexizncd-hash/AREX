# AREX — Sistema de Inteligencia Personal · MARK IV (v183)

> **AREX** es un agente de IA personal con interfaz HUD futurista estilo JARVIS/Iron Man.  
> Su nombre nace de **Alex**iz y Marg**aret** — las dos personas más importantes en su vida.

---

## ¿Qué es AREX?

Sistema de inteligencia personal construido con HTML, CSS y JavaScript puro — sin frameworks ni dependencias de build. Diseñado para uso cotidiano como asistente personal completo: IA conversacional, control de finanzas, negocios, metas, proyectos, visión y más. Funciona como PWA instalable en cualquier dispositivo.

Visualmente inspirado en el JARVIS / Iron Man de Tony Stark: diseño HUD completo estilo Stark Industries con paleta naranja/dorado (`#ff6a00` / `#f5a623`) sobre negro, campo de estrellas animado en canvas, orbe de partículas 3D reactivo, header con animación de barrido, corner brackets en todos los paneles, scan lines, arc reactor en el boot, y grid hexagonal JARVIS en el fondo.

---

## Estructura del proyecto

```
arex/
├── index.html          → Estructura HTML: HUD, header pills, modales, paneles, dock, setup screen
├── style.css           → Diseño futurista / estética Stark Industries / JARVIS
├── app.js              → Motor principal: IA, voz, comandos, tareas, recordatorios, dashboard, canvas
├── jarvis.js           → Navegación entre módulos del dock
├── orb.js              → Orbe 3D WebGL Mark III: GLSL shaders (Fresnel rim, wave displacement, energy bands); fallback 2D canvas
├── finanzas.js         → Lógica del módulo financiero
├── finanzas-data.js    → Datos financieros + funciones de cálculo
├── finanzas.css        → Estilos del módulo financiero
├── negocio.js          → Módulo de gestión del negocio personal (frijol)
├── negocio.css         → Estilos del módulo negocio
├── gastos.js           → Módulo de gastos personales con presupuesto por categoría
├── gastos.css          → Estilos del módulo gastos
├── metas.js            → Módulo de metas y objetivos personales
├── metas.css           → Estilos del módulo metas
├── proyectos.js        → Módulo de proyectos con seguimiento de fases
├── proyectos.css       → Estilos del módulo proyectos
├── evidencias.js       → Módulo de evidencias: guardar respuestas de IA como registros
├── evidencias.css      → Estilos del módulo evidencias
├── control.js          → Mission Control: telemetría del sistema, bitácora, agentes multi-IA
├── control.css         → Estilos de Mission Control
├── vision.js           → Visión MARK IV: análisis IA, gestos personalizables, voz, HUD módulos, acciones contextuales (+ TAREA, + NOTA, COPIAR, BUSCAR PRECIO, ABRIR ENLACE)
├── gesture.js          → Gesture Engine (MediaPipe Hands): señas, swipe, pinch, cursor, partículas
├── parallax.js         → Parallax Engine: profundidad holográfica vía giroscopio / puntero
├── holo.js             → Holo Engine: capa 3D holográfica interactiva estilo Stark (aditiva)
├── webxr.js            → Soporte AR experimental (WebXR, fase 3)
├── search.js           → Búsqueda global Cmd+K: indexa 8 fuentes de datos, overlay con navegación por teclado
├── search.css          → Estilos del overlay de búsqueda global (frosted glass, z-index 9000)
├── vision-orb.js       → Orbe 3D de partículas para el módulo Visión (estados: idle/scanning/analyzing/speaking/error)
├── agenda.js           → Módulo Agenda: vista semanal y mensual agregando tareas, recordatorios y metas
├── agenda.css          → Estilos del módulo Agenda
├── habitos.js          → Módulo Hábitos: hábitos diarios con streaks, mini-calendario semanal, categorías
├── habitos.css         → Estilos del módulo Hábitos
├── sw.js               → Service Worker v183 (PWA / modo offline / cache network-first)
├── manifest.json       → Manifest PWA (instalable en móvil/escritorio)
├── icon.svg            → Ícono de la aplicación
├── config.js           → API keys locales (gitignored — NUNCA se sube al repo)
├── config.example.js   → Plantilla de configuración para nuevos dispositivos
├── firestore.rules     → Reglas de seguridad Firestore (deploy con firebase deploy)
├── firebase.json       → Configuración Firebase CLI (apunta a firestore.rules)
├── FIREBASE_SETUP.md   → Guía paso a paso para activar Auth anónimo y publicar reglas
├── AUDITORIA.md        → Auditoría de seguridad y sprints de mejora
└── README.md           → Este archivo
```

---

## Módulos del dock

| Módulo | Icono | Descripción |
|--------|-------|-------------|
| **INICIO** | ⊞ | Dashboard: estado del negocio, tareas urgentes, finanzas, recordatorios activos, tipo de cambio, clima |
| **CHAT** | ☐ | Chat con IA (Groq), búsqueda web Tavily, análisis de PDF e imágenes, comandos de voz, modo continuo |
| **FINANZAS** | $ | Tarjetas de crédito, saldos, gráficas de gastos, calculadora de deuda, recordatorios de pago |
| **TAREAS** | ✓ | Gestión de tareas con prioridad, fecha límite y ordenamiento automático por urgencia |
| **NOTAS** | ✎ | Notas por categoría (General, Estudio, Ideas, Trabajo, Personal) con búsqueda y sync Firebase |
| **NEGOCIO** | 🫘 | Gestión del negocio de frijol mayocoba: inventario, ventas por medio litro, sucursales (contado/consignación), entregas por tienda con existencia y alerta de resurtido, gastos, meta mensual, gráfica 7 días |
| **GASTOS** | 💸 | Gastos personales diarios por categoría con presupuesto mensual y comparativa visual |
| **METAS** | 🎯 | Objetivos con progreso (numérico o porcentaje), fecha límite y categorías |
| **PROYECTOS** | ▣ | Proyectos personales con fases, estado y seguimiento |
| **CTRL** | ⊡ | Mission Control: telemetría del sistema, bitácora de eventos, panel de agentes multi-IA, exportar/importar datos |
| **REPARTO** | 📍 | Rutas de Reparto: mapa 3D interactivo, geolocalización, clima en tiempo real, mini-dashboard por tienda en el popup (existencia, vendido del mes, última entrega, registrar entrega), rutas guardadas |
| **AGENDA** | 📅 | Calendario semanal/mensual que agrega automáticamente tareas con fecha, recordatorios y metas con deadline |
| **HÁBITOS** | ◎ | Hábitos diarios con streak counter, mini-calendario de los últimos 7 días y categorías personalizables |

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JS puro | Interfaz completa sin frameworks ni bundlers |
| Groq API — llama-4-maverick (fallback llama-3.3-70b) | Motor de IA principal: intenta llama-4 primero, cae automáticamente a llama-3.3 si el key no tiene acceso |
| Groq Vision — llama-4-scout (fallback llama-3.2-11b-vision) | Análisis de imágenes en el modo Visión: intenta llama-4 scout primero, fallback a llama-3.2 vision |
| Gemini 2.5 / 2.0 Flash (Google AI) | Análisis de imágenes con visión mejorada (preferido sobre Groq vision) |
| MediaPipe Hands (CDN) | Detección de manos en tiempo real para gestos, swipe y pinch |
| DeviceOrientation / Pointer | Parallax holográfico con profundidad (giroscopio en móvil) |
| Web Audio + Vibration API | Feedback sonoro y háptico en gestos de la cámara |
| Firebase Firestore | Historial de chat y notas en la nube con sync multi-dispositivo |
| Tavily Search API | Búsqueda web en tiempo real |
| Web Speech API | Reconocimiento de voz (input), modo continuo, comandos en Visión |
| SpeechSynthesis API | Síntesis de voz — AREX habla y saluda proactivamente |
| WebGL + GLSL Shaders | Orbe 3D Mark III: vertex displacement, Fresnel rim, plasma energy bands |
| Canvas 2D API | Campo de estrellas, esqueleto de mano, partículas, fallback orbe |
| Exo 2 + JetBrains Mono | Tipografía futurista vía Google Fonts CDN |
| PWA + Service Worker v183 | Instalable, network-first para shell, cache offline |
| marked.js + DOMPurify | Renderizado seguro de Markdown en el chat |
| highlight.js | Syntax highlighting en bloques de código |
| PDF.js (CDN) | Extracción de texto de archivos PDF |
| frankfurter.app / open.er-api.com | Tipo de cambio USD→MXN (con fallback automático) |
| OpenWeatherMap API | Widget de clima en el dashboard |

---

## Comandos disponibles en el chat

### Conversación
| Comando | Descripción |
|---|---|
| `/ayuda` | Lista todos los comandos disponibles |
| `/limpiar` | Borra el chat y el historial de Firebase |
| `/resumir` | Resume la conversación activa con IA |
| `/exportar` | Descarga la conversación como `.txt` |
| `/examen` | Activa/desactiva modo examen (respuestas detalladas) |
| `/briefing` | Genera el resumen del día: clima, agenda y estado del sistema |

### Herramientas
| Comando | Descripción |
|---|---|
| `/notas` | Abre el panel de notas |
| `/memoria` | Gestiona la memoria permanente (hasta 20 entradas) |
| `/hechos` | Lista los hechos aprendidos automáticamente |
| `/hechos borrar N` | Elimina el hecho número N |
| `/stats` | Estadísticas de uso (mensajes, búsquedas, archivos, voz) |
| `/contexto` | Edita el perfil personal (proyectos, universidad, metas) |
| `/atajos` | Crea y gestiona comandos rápidos personalizados |
| `/config` | Cambia API keys y configuración desde la app |
| `/buscar texto` | Búsqueda global en todos los módulos |
| `/pomodoro` | Abre/cierra el widget Pomodoro |

### Tareas
| Comando | Descripción |
|---|---|
| `/tarea descripción` | Agrega tarea con prioridad media |
| `/tarea texto !alta` | Prioridad: `!alta`, `!media`, `!baja` |
| `/tarea texto @2026-06-01` | Con fecha límite |
| `/tarea texto !alta @2026-06-01` | Prioridad + fecha combinadas |

### Recordatorios
| Comando | Descripción |
|---|---|
| `/recordar 30min mensaje` | Recordatorio en 30 minutos |
| `/recordar 2h mensaje` | Recordatorio en 2 horas |
| `/recordar 20:00 mensaje` | A hora específica del día |
| `/recordar` | Lista recordatorios activos con countdown |

> Los recordatorios son **persistentes**: sobreviven recargas. Si la app estaba cerrada cuando venció uno, aparece como "perdido" en el dashboard.

---

## Orbe 3D Mark III — WebGL + GLSL

El orbe central de AREX usa un renderer WebGL con shaders GLSL personalizados, sin dependencias externas. Si WebGL no está disponible, cae automáticamente al modo 2D Canvas (esfera de partículas Fibonacci).

### Shaders (WebGL path)
- **Vertex shader**: esfera de 40×40 subdivisiones con desplazamiento de vértices en tiempo real (función seno multi-frecuencia animada). Cada estado del sistema tiene amplitud/frecuencia propia.
- **Fragment shader**: efecto Fresnel (brillo en los bordes de la esfera, como un holograma), bandas de energía en latitud (co-rotan con la esfera), espirales en longitud, y núcleo de iluminación frontal. Todo ajustado con uniforms por estado.
- **Blending aditivo**: `SRC_ALPHA + ONE` para apariencia de holograma translúcido sobre cualquier fondo.

| Estado | Color | Comportamiento |
|--------|-------|----------------|
| En espera | Cyan | Rotación lenta, sin desplazamiento |
| Hablando | Blanco azulado | Rotación rápida, desplazamiento fuerte (amp=0.12), bandas intensas |
| Pensando | Azul profundo | Velocidad media, desplazamiento sutil, frecuencia baja |
| Escuchando | Verde | Rotación lenta, desplazamiento mínimo |
| Buscando | Naranja | Rotación rápida, desplazamiento fuerte, bandas veloz |

---

## Visión MARK IV (cámara)

El módulo de Visión convierte la cámara en una interfaz estilo Tony Stark: pantalla completa translúcida, HUD holográfico y control por señas y voz — todo simultáneo, **sin salir jamás de la cámara**.

### Gesture Engine (`gesture.js`)
MediaPipe Hands rastrea la mano a ~15 fps y dibuja un esqueleto cian con cursor, estela del dedo y partículas. Cada evento dispara vibración háptica + beep Web Audio.

| Seña / movimiento | Acción por defecto | Personalizable |
|---|---|---|
| ✋ Mano abierta | Analizar la escena con IA | ✓ |
| ✊ Puño | Detener modo continuo / voz | ✓ |
| ☝ Índice arriba | Abrir grid de módulos | ✓ |
| ✌ Victoria | Alternar modo AUTO | ✓ |
| 👍 Pulgar arriba | Activar/desactivar comandos de voz | ✓ |
| ◀ ▶ Swipe horizontal | Ver HUD del módulo anterior / siguiente | — |
| ▲ Swipe arriba | Cerrar HUD de módulo (o cerrar cámara) | — |
| ▼ Swipe abajo | Abrir grid de módulos | — |
| 🤏 Pinch (pulgar+índice) | Clic en el elemento donde apunta el dedo | — |

**Cada seña se puede reasignar** desde el panel ⚙ de la guía de gestos (almacenado en `arex_gesture_map`). Acciones asignables: analizar, escena, objeto, texto, recibo, detener, módulos, auto, micrófono, cambiar cámara.

### Module HUD — interactuar sin salir de la cámara
Al deslizar (swipe) o decir el nombre de un módulo por voz, aparece un **panel HUD flotante** sobre la cámara con el resumen del módulo en tiempo real:

| Módulo | Datos mostrados |
|---|---|
| Tareas | N pendientes, N vencidas, top 5 tareas |
| Gastos | Total del mes, top 3 categorías |
| Metas | N activas, barra de progreso % |
| Finanzas | N tarjetas, deuda total |
| Negocio | Ingresos del día, stock |
| Proyectos | N proyectos activos |

Desde el HUD: botón **ABRIR →** para navegar al módulo, botón **+ TAREA** o **+ GASTO** para agregar sin tocar el teclado.

### Comandos de voz (siempre escuchando · sin conflicto con modo AR)
Di **"AREX" + comando**:

| Comando de voz | Acción |
|---|---|
| `analizar` / `escena` / `objeto` / `texto` | Análisis de imagen |
| `recibo` / `ticket` | Escaneo de recibo → gasto automático |
| `finanzas` / `metas` / `gastos` / `tareas` / etc. | Muestra HUD del módulo (sin cerrar cámara) |
| `abrir finanzas` / `ir a tareas` | Cierra cámara y navega al módulo |
| `nueva tarea X` / `agregar tarea X` | Crea tarea (con "alta" / "baja" para prioridad) |
| `gasto 150 comida` | Registra gasto directo sin salir de cámara |
| `auto` / `continuo` | Alternar modo análisis continuo |
| `silencio` / `voz on` | Toggle síntesis de voz |
| `módulos` / `navegar` | Abrir grid de módulos |
| `cerrar` / `salir` | Cerrar cámara |

> Cuando el modo de voz de Visión está activo, el modo AR de JARVIS se pausa automáticamente para evitar conflicto de SpeechRecognition. Al cerrar Visión, se restaura.

### HUD holográfico
- **Telemetría** (izquierda): resolución, motor IA, modo, última seña, estado de voz
- **Guía de gestos** (derecha) con botón ⚙ para configurar asignaciones
- **Barra de onda de voz** (abajo) con animación de onda activa
- **Grid de módulos** translúcido para navegación táctil
- **Flash de gesto** central para retroalimentación visual
- Profundidad 3D real con parallax por giroscopio (`parallax.js`)

### 🧾 Escaneo de recibos → gasto automático
Apunta a un ticket y pulsa **RECIBO** (o di "AREX recibo"). AREX extrae total, comercio, fecha y categoría, y **registra el gasto automáticamente** en el módulo Gastos.

### Personas conocidas
Guarda descripciones físicas de personas; AREX las reconoce y saluda por su nombre en cámara (`arex_personas`).

---

## Interacciones dinámicas

- **Swipe en tareas**: desliza una tarjeta → completar/reabrir (derecha) o borrar (izquierda), con háptica
- **Saludos proactivos**: al abrir un módulo, AREX dice lo relevante por voz (tareas vencidas, % de meta, gasto del mes, stock bajo)
- **Badges de urgencia**: contador rojo pulsante de tareas vencidas en el dock
- **Indicador de habla**: puntos animados en el mensaje mientras AREX habla
- **Parallax global**: orbe, reactor y paneles HUD flotan con la inclinación del dispositivo

---

## Mission Control (`/ctrl`)

Panel de administración del sistema con tres vistas:

**Telemetría**
- Estado de conexión: Groq IA, Gemini IA, Firebase
- Versión del Service Worker activa
- Uptime de la sesión actual
- Uso de almacenamiento local

**Bitácora**
- Log de eventos en tiempo real (hasta 500 entradas)
- Filtros por módulo: chat, finanzas, negocio, sistema...
- Timestamp de cada acción registrada

**Agentes**
Panel de estado de los 4 agentes especializados del sistema multi-IA:

| Agente | Dominio | Color |
|--------|---------|-------|
| HERMES | Finanzas y gastos | Verde |
| ATLAS | Negocio y operaciones | Naranja |
| SENTINEL | Sistema y seguridad | Morado |
| SCRIBE | Chat e información | Cyan |

---

## Módulo Negocio (Frijol)

Gestión completa del negocio personal de venta de frijol en medios litros:

- **Dashboard**: KPIs del mes (stock, ventas, ganancia), barra de meta mensual, gráfica de ventas 7 días, actividad reciente
- **Ventas**: registrar con sucursal/cantidad/precio/fecha, historial con editar y borrar
- **Inventario**: stock actual en kg, entradas de producto, historial de movimientos, corrección manual de stock
- **Sucursales**: puntos de venta con métricas del mes, estado activa/pausada, editar y borrar
- **Gastos**: gastos del negocio por tipo (materia prima, empaque, transporte, otro) con editar y borrar
- **Config**: precio de venta, costo por kg, rendimiento, costo de empaque, meta mensual — con calculadora de rentabilidad en tiempo real

---

## Persistencia de datos

| Dato | Almacenamiento | Key |
|---|---|---|
| API keys | localStorage | `arex_config` |
| Historial de chat | Firebase Firestore | colección `conversations` |
| Sesiones de chat | localStorage | `arex_sessions` |
| Tareas | localStorage | `arex_tareas` |
| Recordatorios | localStorage | `arex_recordatorios` |
| Notas | Firebase Firestore | colección `notes` |
| Hechos aprendidos | localStorage | `arex_hechos` |
| Memoria permanente | localStorage | `arex_memoria` |
| Atajos personalizados | localStorage | `arex_atajos` |
| Contexto personal | localStorage | `arex_context` |
| Finanzas (overrides) | localStorage | `arex_finanzas_overrides` |
| Negocio (frijol) | localStorage | `arex_negocio` |
| Gastos personales | localStorage | `arex_gastos_pers` |
| Metas/objetivos | localStorage | `arex_metas` |
| Proyectos | localStorage | `arex_proyectos` |
| Evidencias | localStorage | `arex_evidencias` |
| Personas conocidas (Visión) | localStorage | `arex_personas` |
| Bitácora Mission Control | localStorage | `arex_bitacora` |
| Tipo de cambio (caché) | localStorage | `arex_fx_cache` |
| Briefing del día | localStorage | `arex_briefing_date` |

---

## Configuración de API keys

Las keys se guardan en `localStorage` — nunca en el repo.  
Para configurarlas: `/config` en el chat, o pantalla de setup en primer arranque.

| Key | Dónde obtenerla | Requerida |
|---|---|---|
| Groq API Key | console.groq.com | **Sí** — motor de IA principal |
| Gemini API Key | aistudio.google.com | No — habilita visión mejorada |
| Tavily API Key | app.tavily.com | No — habilita búsqueda web |
| OpenWeatherMap Key | openweathermap.org | No — habilita widget de clima |
| Firebase (6 campos) | console.firebase.google.com | No — habilita sync en la nube |
| Firebase VAPID Key | Consola Firebase → Cloud Messaging → Web Push | No — habilita push notifications FCM |

> **Seguridad**: `config.js` está en `.gitignore` y nunca se commitea. Contiene credenciales reales. No compartir ni subir al repo bajo ninguna circunstancia.

---

## Changelog

### v117 — Liquid Glass System: superficies de vidrio líquido + GPU ×6 más eficiente

**`style.css`** (nueva sección v117 — unlayered, gana sobre todo)
- Variables blur reducidas: `--blur-sm: 3px` (era 10), `--blur-md: 6px` (era 18), `--blur-lg: 10px` (era 26)
- GPU: área de muestreo por compositing layer cae de π·26² ≈ 2,123 px² → π·10² ≈ 314 px² (×6.7 menos por panel)
- Sistema de tokens Liquid Glass: `--lg-specular-top/left`, `--lg-refract-iron`, `--lg-shadow-depth`
- Capa de "atmósfera ambiental" en `body::after`: 2 radial-gradients cálidos (iron/cyan) que dan profundidad sin blur adicional
- **13 superficies** rediseñadas con Liquid Glass CSS (cero JS, cero canvas extra):
  - `.module-panel` — vidrio con borde especular superior + refracción iron inferior
  - `.hud-panel` — glass ligero (blur-sm), highlight blanco en borde top
  - `.dhud-panel` — dashboard cards con hover suave (border + glow transition)
  - `header` — glass horizontal, highlight interior superior + refracción iron inferior
  - `.sidebar` — glass lateral, micro-specular izquierdo
  - `#dock` — glass inferior, border-top especular
  - `.modal-box` — única superficie con blur real generoso (14px) ya que es transitoria y única
  - `.bg-container` — search overlay con blur 16px (también transitorio)
  - `.input-wrap/.input-row` — glass mínimo en input area
  - `.metric-card`, `.nota-card`, `.tarea-item`, `.inicio-card` — cards con borde especular sin backdrop-filter
  - `.pomo-widget` — glass suave

**`app.js`**
- `applyPerformanceProfile()` simplificado: low-end setea todo a 0px (el Liquid Glass visual vía borders/shadows sigue activo); mid/high ya no necesita override (defaults 3/6/10 son eficientes)

### v116 — CSS @layer Architecture: eliminación estructural de !important

**`style.css`**
- Implementado sistema CSS `@layer arex-base` para resolver el conflicto estructural de cascada
- Todo el CSS base (líneas 1–5636) envuelto en `@layer arex-base { }` — menor prioridad en cascada
- Los bloques v63 (Translucency), v64 (Neural Orbs) y v65 (Iron Man HUD) quedan sin capa (unlayered), ganando automáticamente sobre el base por diseño del spec CSS
- Eliminados **790 `!important`** de los bloques v63/v64/v65 — ahora innecesarios gracias a la precedencia de reglas sin capa sobre capas
- Reducción total: **1,075 → 336 `!important`** (−69%)
- Los 336 restantes son legítimos (utilidades `.hidden`, overrides móviles en `@media`, glow/animation helpers)

### v115 — CSS blur variables + adaptive performance profile

**`style.css`**
- Variables CSS `--blur-sm: 10px`, `--blur-md: 18px`, `--blur-lg: 26px` en `:root`
- Reemplazados los 87 `backdrop-filter: blur(Npx)` con tiers de variables: sm/md/lg
- `@media (prefers-reduced-motion: reduce)` agregado al final del archivo — desactiva todas las animaciones para usuarios con sensibilidad al movimiento
- Removida animación `@keyframes appear` duplicada (línea 1134)

**`app.js`**
- IIFE `applyPerformanceProfile()`: detecta `hardwareConcurrency` y `deviceMemory` al arranque; en dispositivos low-end (≤4 cores o ≤2GB) setea `--blur-sm/md/lg` a 0px/0px/4px vía `setProperty`; en mid-end reduce a 6/12/18px

**`index.html`**
- Atributo `defer` agregado a 3 scripts CDN (`marked.min.js`, `purify.min.js`, `highlight.min.js`) para dejar de bloquear el parser HTML

### v83 — Sprint A Multi-usuario: Google Sign-In + Perfiles (AREX/VIERNES) + Sistema de identidades

**Google Sign-In (`app.js`)**
- Auth reemplazado: anónimo → Google Sign-In (`signInWithPopup` con fallback a `signInWithRedirect`)
- Login overlay: pantalla elegante con botón "Entrar con Google" (estética AREX, cyan sobre negro)
- `onAuthStateChanged` es la fuente de verdad: con usuario → boot normal; sin usuario → login overlay
- Offline fallback: uid cacheado en localStorage permite arrancar sin red si ya hubo un login previo
- Botón "Cerrar sesión" en el sidebar (llama `window._arexSignOut`)
- Info del usuario (nombre + avatar) en el sidebar mientras está logueado

**Sistema de perfiles (`app.js`)**
- `window._arexProfile` — objeto de perfil activo: `assistantName`, `ownerName`, `personality`, `voiceGender`, `voicePitch`, `voiceRate`, `location`, `activeModules`, `accent`
- Guardado en `users/{uid}/arex/profile` (Firestore) + caché en localStorage
- Primer login sin perfil → onboarding: nombre del asistente, nombre del usuario, voz
- Alexiz (datos migrados) → perfil AREX precargado sin onboarding
- VIERNES (Margaret): nombre del asistente distinto, voz femenina, pitch 1.05

**System prompt dinámico (`buildSystemBase()`)**
- Lee `window._arexProfile` en cada llamada: `assistantName`, `ownerName`, `location`, `personality`
- El contexto personal de Alexiz (QUIÉN ES ALEXIZ, negocio de frijol, Margaret) solo aparece cuando `ownerName === 'Alexiz'`
- Tono parametrizable: formal / cálido / amistoso
- Frases características adaptadas por nombre del asistente

**Voz dinámica (`getVoice(profile)`, `arexSpeak()`)**
- `getMaleVoice()` reemplazado por `getVoice(profile)` — elige voz masculina o femenina española
- `arexSpeak()` usa `profile.voicePitch` y `profile.voiceRate` en lugar de valores hardcodeados
- VIERNES: voz femenina por defecto, pitch 1.05, rate 0.94

**UI de perfil (`index.html`)**
- `id="hdr-assistant-name"` en el header → se actualiza al cargar el perfil
- Onboarding modal con 3 campos: nombre asistente, nombre usuario, tipo de voz
- Sección Usuario en el sidebar: nombre, asistente activo, botón de logout

**SW v83**

### v82 — Sprint A: Seguridad Firestore + Auth anónimo + Arranque rápido

**Firebase Auth anónimo (`app.js`)**
- `initFirebase()` importa ahora `firebase-auth.js` junto con Firestore
- `signInAnonymously()` se llama al inicializar; el uid se conserva entre sesiones por la persistencia local de Firebase Auth
- El sync (initRealtimeSync, pull, historial) solo arranca cuando `onAuthStateChanged` confirma un uid
- Si el auth falla (sin red), la app sigue funcionando 100% con localStorage — UI nunca bloqueada

**Migración de rutas a per-usuario (`app.js`)**
- Todas las rutas de Firestore migradas: `arex_data/{key}` → `users/{uid}/arex_data/{key}`
- Mismo patrón para `conversations`, `notes`, `arex/config`, `stats`
- Helpers `_userDoc(...segs)` y `_userCol(...segs)` centralizan la construcción de paths
- Migración one-time: al primer login con uid, copia datos de rutas viejas a la nueva estructura (flag `arex_migrated_v1` en localStorage para no repetir)

**Reglas de seguridad Firestore (`firestore.rules`, `firebase.json`)**
- Reglas que niegan todo por defecto y permiten solo `users/{uid}/**` cuando `auth.uid == uid`
- `firebase.json` para deploy con `firebase deploy --only firestore:rules`
- `FIREBASE_SETUP.md` con instrucciones en español para activar Auth anónimo y publicar reglas

**Arranque rápido (`index.html`, `jarvis.js`, `app.js`, `sw.js`)**
- Todos los módulos locales ahora usan `defer` → descarga paralela, sin bloquear el parser
- Lazy-load de motores pesados (reparto.js, holo.js, parallax.js, vision-orb.js, vision.js): se inyectan dinámicamente tras la primera interacción o a los 4s de inactividad
- `reparto.js` se lazy-carga en `jarvis.js` cuando el usuario abre el módulo REPARTO
- SW shell reducido: se quitaron los 5 archivos lazy del precache inicial
- Scripts en el boot antes/después: 17 → 12 (sin los 5 lazy)

**SW v82**

### v81 — Corrección de bugs críticos en INICIO, Agenda y Evidencias

**Dashboard INICIO en blanco (`app.js`)**
- `renderDashboard()` lanzaba `TypeError: _agGetEvents(...).filter is not a function` porque `_agGetEvents()` retorna un objeto `{ 'yyyy-mm-dd': [...] }`, no un array
- Corregido en 3 lugares: `renderDashboard`, `generarBriefing` y `mostrarResumenHoy` — ahora usan `_agGetEvents()[hoyStr] || []`

**Panel Evidencias no llenaba la pantalla (`evidencias.css`)**
- Faltaba la regla `#module-evidencias.module-panel.active` con `display:flex; flex:1`
- Sin ella, el panel quedaba reducido en tamaño al activarse

**Chips de tareas sin estilo en Agenda (`agenda.js`)**
- Los eventos de tipo `tarea` tenían `color: 'cyan'` pero el CSS solo define `.dhud-agev-blue`, `.dhud-agev-orange`, `.dhud-agev-green`
- Corregido a `color: 'blue'`

### v76 — Bloque 3: Offline, Análisis IA, Reporte semanal, Hitos en metas, Alerta de clima

**Modo offline inteligente (`app.js`)**
- Banner naranja en la parte superior cuando no hay conexión (`navigator.onLine` + eventos)
- Cuando el chat está offline, responde con datos locales relevantes (tareas, notas, metas, recordatorios) en lugar de error genérico
- Fallback en el catch de `callGroq` / `streamArexReply` para errores de red
- Comandos `/` siguen funcionando sin internet (son locales)

**Análisis IA de gastos y metas (`app.js`)**
- `/analizar gastos` — envía los últimos 3 meses de gastos a Groq, recibe: tendencia, categoría más alta, 3 recomendaciones concretas
- `/analizar metas` — evalúa progreso de metas activas, identifica las en riesgo y da acciones para la semana

**Reporte semanal (`app.js`)**
- `/semana` — genera un reporte markdown motivador con: tareas completadas/pendientes, gastos, progreso de metas, hábitos de la semana
- Cubre lunes-domingo de la semana en curso

**Hitos en metas (`metas.js` + `style.css`)**
- Cada meta ahora soporta `hitos: [{id, texto, completado}]`
- UI: lista de checkpoints bajo cada meta con toggle/delete
- Agregar hito con Enter en el input inline
- Funciones globales: `addHito(metaId, texto)`, `toggleHito`, `deleteHito`

**Alerta de clima (`app.js` + `style.css`)**
- Si el forecast de las próximas 12h tiene probabilidad de lluvia > 65% o condiciones severas (tormenta, nieve, etc.), muestra un banner naranja de alerta con la hora estimada

**SW v76**

### v75 — Bloque 2: Hábitos + Subtareas + Briefing mejorado + Memoria conversacional + Búsqueda historial

**Módulo Hábitos (`habitos.js` + `habitos.css`)**
- Hábitos con emoji, categoría (Salud/Ejercicio/Mente/Trabajo/Personal), frecuencia (Diaria/Semanal/Lunes-Viernes)
- Toggle de completado para hoy con streak counter `🔥 N días`
- Mini-calendario 7 días (Mon-Sun) con puntos cyan/apagado
- Inline form para agregar nuevos hábitos
- Confirmación de 2 pasos para eliminar; sync a Firebase vía `arexSyncData`

**Subtareas (`app.js` + `style.css`)**
- Los objetos de tarea ahora soportan `subtareas: [{id, text, done}]`
- Funciones: `addSubtarea`, `toggleSubtarea`, `deleteSubtarea`
- UI: lista collapsible bajo cada tarea pendiente; badge `X/N` de progreso
- Agregar subtarea con Enter en el campo inline de texto; delete con confirmación
- Subtareas completadas con tachado y opacidad reducida

**Briefing matutino mejorado (`app.js`)**
- Ahora incluye: metas activas con progreso (`titulo: X/Y`), gastos del mes, hábitos pendientes hoy, agenda del día
- Prompt actualizado: permite 4-6 líneas con 2-3 bullet points; max_tokens 380
- Los datos de hábitos y agenda se inyectan solo si los módulos están cargados

**Memoria conversacional (`app.js`)**
- `_autoSummarizeSession()`: al guardar una sesión con ≥6 mensajes, llama a Groq para extraer 1-2 oraciones de contexto clave
- `arex_session_memories`: almacena los últimos 12 resúmenes de sesión (`{fecha, session, resumen}`)
- `buildSessionMemorySection()`: inyecta los 4 resúmenes más recientes en el system prompt de cada llamada
- El modelo ahora recuerda contexto de conversaciones pasadas automáticamente

**Búsqueda en historial de chat (`search.js`)**
- `Cmd+K` ahora busca también en `arex_sessions` (hasta 10 sesiones guardadas)
- Grupo `💬 HISTORIAL` en resultados con nombre de sesión, snippet y fecha
- Click en resultado carga la sesión directamente vía `loadSession(sid)` y navega al chat

**SW v75**

### v74 — Bloque 1: Real-time sync + FCM + Agenda + Quick Capture + Tareas Recurrentes

**Tareas recurrentes (`app.js`)**
- `addTarea` acepta nuevo parámetro `repetir`: `ninguna | diaria | semanal | mensual | anual`
- Al completar una tarea con recurrencia, `toggleTarea` genera automáticamente la siguiente ocurrencia con fecha calculada
- Badge `↻ diaria` visible en cada tarea recurrente; selector de recurrencia en el formulario de edición

**Quick Capture universal (`app.js` + `style.css` + `index.html`)**
- Botón flotante `+` (FAB) siempre visible en la esquina inferior derecha
- Atajo de teclado `Q` para abrir/cerrar desde cualquier lugar
- IA con debounce 700ms clasifica el texto como **tarea / nota / gasto / meta** usando `llama-3.3-70b-versatile`
- Campos extras dinámicos según tipo: fecha+prioridad para tareas, monto+categoría para gastos
- Guarda directamente en el módulo correcto; se oculta automáticamente en modo Visión

**Módulo Agenda/Calendario (`agenda.js` + `agenda.css`)**
- Vista **semanal** (7 columnas, 4 en móvil): día actual resaltado con borde cyan
- Vista **mensual**: grid 7×N con puntos de color por tipo de evento
- Agrega automáticamente: tareas con `fecha`, recordatorios (`arex_recordatorios`) y metas con `deadline`
- Chips de colores: cyan = tareas, naranja = recordatorios, verde = metas
- Click en evento navega directamente al módulo de origen (`AREXNav.cambiarModulo`)
- Botón en el dock (📅) + integrado en la navegación de jarvis.js

**onSnapshot real-time sync (`app.js`)**
- `initRealtimeSync()`: escucha en tiempo real los documentos Firestore de `arex_tareas`, `arex_metas`, `arex_notas` y `arex_recordatorios`
- Actualiza localStorage y re-renderiza automáticamente si el timestamp remoto es mayor que el local
- Sin polling — conexión persistente push desde Firebase; se limpia y reinicia al reconectar Firebase

**FCM Push Notifications (`app.js` + `sw.js`)**
- `initFCM()`: importa `firebase/messaging` dinámicamente, solicita permiso y obtiene token FCM
- El token se guarda en `localStorage['arex_fcm_token']` para uso externo (Cloud Functions)
- Mensajes en foreground manejados con `onMessage` → muestra notificación nativa vía SW
- Campo **VAPID Key** en ambas pantallas de configuración (setup inicial y `/config`)
- SW `push` event handler: recibe push del servidor y muestra notificación con icono AREX, vibración y `renotify: true`
- **SW v74**

### v73 — Módulo Agenda + correcciones menores
- Creación de `agenda.js` y `agenda.css`; SW bumpeado a v73

### v72 — Orbes 3D con partículas reales + Visión libre e interactiva

**Orbes neurales en verdadero 3D (`neural-orb.js`)**
- Los 40 nodos ahora **orbitan** en 3D usando matrices de rotación Y+X aplicadas cada frame (antes estaban fijos)
- `_updatePositions()` transforma `ox/oy/oz` → `x/y/z` con perspectiva real (`fov / (fov + z + 1.2)`)
- Cada instancia tiene su propia velocidad y ángulo de inicio aleatorios
- Los estados `thinking` (×2.4) y `speaking` (×3.2) aceleran la rotación
- Nuevo estado `scanning` para integración con Visión
- Tilt suave sinusoidal en eje X (eje X oscila ±0.06 rad con el tiempo)

**Orbe 3D de partículas en Visión (`vision-orb.js` — nuevo archivo)**
- Orbe 88×88px con 55 partículas en el HUD superior izquierdo de la cámara
- 5 estados visuales: `idle` (cyan lento), `scanning` (giro rápido + burst), `analyzing` (blanco-cyan explosión), `speaking` (verde), `error` (rojo)
- Se sincroniza automáticamente con el estado de AREX: analizar → `analyzing`, hablar → `speaking`, AUTO → `scanning`
- Misma arquitectura que neural-orb: Fibonacci sphere + perspectiva + pulsos + rim glow + specular

**Visión libre e interactiva (`vision.js`)**
- **Tap en cualquier punto** → AREX analiza esa región específica (crop 55% alrededor del tap) con reticle de mira animado
- **Mantener presionado 650ms** → Abre la barra de pregunta libre
- **Barra de pregunta libre (siempre disponible)**: escribe cualquier cosa, AREX analiza lo que ve + responde conversacionalmente
- **Voz natural sin restricciones**: si dices "AREX" + cualquier cosa que no sea un comando conocido, se trata como pregunta libre sobre la vista actual — sin necesidad de memorizar comandos exactos
- Hint inferior actualizado: "TAP = ANALIZAR ZONA · MANTENER = PREGUNTAR LIBRE"

- **SW v72**

### v71 — Búsqueda global Cmd+K + Export/Import + Firebase sync completo + Vision mejorado

**Búsqueda global (`search.js` + `search.css`)**
- Overlay `Cmd+K` / `Ctrl+K` con glass morphism (z-index 9000)
- Indexa 8 fuentes: tareas, notas, metas, proyectos, gastos, evidencias, hechos, bitácora
- Resultados agrupados por módulo con contadores, highlights `<mark>` y navegación por teclado (↑↓ Enter Esc)
- Click navega directamente al módulo via `AREXNav.cambiarModulo()`

**Export / Import (`control.js` — pestaña DATOS)**
- **JSON full backup** con timestamp → descarga `arex-backup-YYYY-MM-DD.json`
- **CSV gastos** con BOM (compatible Excel) → descarga `arex-gastos-YYYY-MM-DD.csv`
- **CSV tareas** → descarga `arex-tareas-YYYY-MM-DD.csv`
- **Import JSON**: restaura todos los `arex_*` keys, re-sincroniza Firebase, re-renderiza módulos
- Barra de uso de almacenamiento por módulo + estadísticas de sync

**Firebase sync completo (`app.js`)**
- `pullAllModuleData()` ahora sincroniza 18 keys (antes 9 — faltaban proyectos, evidencias, notas, finanzas, reparto, personas)
- Resolución de conflictos por `_updatedAt`: el más reciente gana
- `arexSyncData()` incluye `_updatedAt: Date.now()` en cada push

**Visión MARK IV — vidrio real + interactividad (`vision.js` + `style.css`)**
- Panel resultado con `background: rgba(0,4,12,0.50)` + `backdrop-filter: blur(28px)` (antes casi opaco)
- HUD con gradientes reducidos para más transparencia sobre la cámara
- **Acciones contextuales**: después de cada análisis aparecen botones según el modo
  - Modo describe/escena → `+ TAREA`, `+ NOTA`, `COPIAR`
  - Modo objeto/producto → `BUSCAR PRECIO`, `+ NOTA`, `COPIAR`
  - Modo texto/QR → `COPIAR`, `ABRIR ENLACE` (si detecta URL)

**Visión AUTO — sin congelarse (`vision.js`)**
- Ciclo continuo: 1800ms → 3500ms (menos competencia con la cámara)
- Modelo rápido `llama-4-scout-17b-16e-instruct` en AUTO (era maverick)
- Canvas cacheado — `_captureCanvas` reutilizado para reducir GC
- Video keep-alive: si `_video.paused`, se reanuda automáticamente
- Timeouts reducidos: 12s (AUTO) / 16s (manual), con `AbortController` en la API call

- **SW v71**

### v66 — Color verde neón + módulo Rutas de Reparto con mapa 3D
- **Paleta verde**: `#00ff88` neón + `#00e5cc` teal reemplazan el naranja en todo el sistema
- **Paneles más translúcidos**: `rgba(0,5,14,0.36)` — se ve más el fondo estelar
- **Scan lines y decoraciones reducidas**: menos ruidoso visualmente
- **Módulo Rutas de Reparto** (nuevo):
  - Mapa 3D interactivo con MapLibre GL JS cargado bajo demanda (no penaliza carga inicial)
  - Cámara inclinada 48° (estilo Apple Maps 3D) con bearing rotado
  - Tiles CARTO dark con filtro CSS `hue-rotate(112deg)` → tinta verde AREX
  - Geolocalización GPS real con marcador animado pulsante
  - Clima en tiempo real (OpenWeatherMap) + región (Nominatim geocoding inverso)
  - Integración con Negocio: carga sucursales del módulo como marcadores en el mapa
  - Botón 📍 para fijar coordenadas GPS a cada sucursal sin salir del módulo
  - Clic en mapa → agrega waypoints a la ruta activa con línea verde punteada
  - "RUTA COMPLETA" → traza ruta automática por todas las sucursales activas
  - Rutas guardadas por nombre con carga y eliminación
  - Sidebar: sucursales, waypoints activos, rutas guardadas
  - Controles del mapa (zoom/compass/escala) con tema verde AREX
- **SW v66**

### v65 — Iron Man / Tony Stark HUD full-system redesign
- **Paleta completa rediseñada**: naranja Stark `#ff6a00` + dorado `#f5a623` reemplazan el cian como color de acento primario en toda la interfaz
- **Boot screen — Arc Reactor**: borde naranja pulsante con tres anillos concéntricos de resplandor, texto dorado con glow, barra de carga con gradiente naranja→dorado, fondo rotativo cónico tipo reactor
- **Header — Puente de mando**: bordes naranja, sweep de luz animado, líneas verticales de cuadrícula, pill derecho con clip-path diagonal
- **Dock**: pilar naranja animado en el borde derecho, logo ring con efecto arc-reactor, botones activos con brillo naranja
- **Todos los módulos**: scan lines horizontales sutiles, borde superior naranja/dorado degradado, corner brackets en vistas
- **Chat**: orbe central con efecto arc-reactor naranja, HUD panels con acento naranja, input naranja temático
- **Mission Control**: telemetría y agentes con headers naranja, bordes con gradiente top
- **Neural Orb Engine v2**: esfera más fotorrealista con rim lighting, capa volumétrica, nodo con highlight blanco interno, pulsos con núcleo white-hot, anillos de actividad expansivos, segunda reflexión especular
- **Grid JARVIS global**: cuadrícula naranja muy sutil en todo el fondo del sistema
- **Tipografía**: Exo 2 + JetBrains Mono aplicados globalmente en todos los elementos HUD
- **SW v65**

---

## Visión a largo plazo — Camino a Jarvis

### Lo que ya funciona
- IA conversacional con memoria, contexto y hechos aprendidos
- Voz bidireccional (input + output) con síntesis en español y saludos proactivos
- Módulos de vida completos: finanzas, tareas, notas, negocio, metas, proyectos
- **Visión JARVIS**: control por señas (MediaPipe), swipe, pinch-to-click y comandos de voz
- **Escaneo de recibos** con extracción IA → gasto registrado automáticamente
- HUD holográfico translúcido con parallax 3D por giroscopio
- Swipe en tareas, badges de urgencia, indicador de habla animado
- Orbe de partículas 3D reactivo al estado del sistema
- Mission Control: telemetría, bitácora y panel multi-agente
- PWA instalable, funciona parcialmente sin internet
- Auto-búsqueda web cuando el contexto lo requiere
- Sincronización Firebase para chat y notas

### Próximas fases
- **Firebase onSnapshot**: sync en tiempo real entre dispositivos para todos los módulos
- **Habit tracker**: racha diaria con heatmap semanal
- **Notificaciones push**: recordatorios en background aunque la app esté cerrada
- **Calendario / Agenda**: eventos, citas, vencimientos conectados con tareas
- **Reportes del negocio**: resumen semanal/mensual exportable
- **Google Calendar**: integración OAuth para agenda real

### Visión Jarvis completa (largo plazo)
- Wake word — activación por voz sin tocar la pantalla
- Modo ambient — AREX proactivo: "tienes 3 tareas para hoy", "stock bajo"
- WebXR Phase 3 — panel holográfico en AR (Meta Quest 3S)
- Knowledge graph — conexiones automáticas entre notas, tareas y hechos
- Multi-agente completo — AREX delega subtareas a HERMES, ATLAS, SENTINEL, SCRIBE
- IA local offline con Ollama

---

## Historial de versiones (MARK)

| Versión | Cambios principales |
|---------|---------------------|
| **MARK 1–5** | UI futurista HUD + motor IA + voz + comandos base |
| **MARK 6–10** | Firebase + búsqueda web + PDF + imágenes + estadísticas |
| **MARK 11–15** | Modo examen + PWA + setup screen + Markdown + contexto personal |
| **MARK 16** | Sesiones múltiples de chat |
| **MARK 17–19** | Atajos + análisis de URLs + auto-búsqueda por contexto |
| **MARK 20** | Panel de código en vivo (iframe sandbox, editor) |
| **MARK 21–25** | Voz del sistema + memoria permanente + notas con categorías |
| **MARK 26** | Módulo Finanzas: tarjetas, gráficas, calculadora de deuda |
| **MARK 27** | Dock lateral + módulo Tareas con badge de urgencia |
| **MARK 28** | Sesiones múltiples + selector en sidebar |
| **MARK 29** | Tareas con fecha límite, prioridad y ordenamiento |
| **MARK 30** | Dashboard INICIO con resumen de todos los módulos |
| **MARK 31** | Recordatorios persistentes con countdown y widget |
| **MARK 32** | Módulo SOS: emergencias con GPS, 911, SMS, WhatsApp |
| **MARK 33** | Fix crítico: Firebase como dynamic import para no bloquear el boot |
| **MARK 34** | 5 bugs críticos: `gp.gastos` vs `gp.transacciones`, `sucursalId` lookup, errores de voz |
| **MARK 35** | Tablero de Evidencias, Mission Control, Gemini Vision, sistema multi-agente (HERMES/ATLAS/SENTINEL/SCRIBE), bitácora de eventos, badge de estado |
| **MARK 36** | Rediseño visual JARVIS completo: header pills, campo de estrellas canvas, status-float sobre el orbe, grid de acceso rápido, animación de boot letra por letra, UX móvil (44px touch targets, 16px inputs) |
| **MARK 37** | Orbe de partículas 3D (Fibonacci sphere, 80 partículas, K-nearest edges, perspectiva real, 5 estados reactivos); corrección de 4 bugs: Firebase OFFLINE en telemetría, "v4" en boot, versión SW, doble animación conflictiva; protección completa de JSON.parse contra datos corruptos en localStorage; canvas pausa cuando el tab está oculto; star field no se reconstruye en cada resize |
| **MARK 38** | Auditoría completa de los 10 módulos: estados múltiples en proyectos, reactivar metas, alerta de stock mínimo en negocio, comparativa mes anterior en gastos, doble estrategia en finanzas, búsqueda y "ver más" en evidencias, export de notas, glow reforzado en tareas urgentes/vencidas |
| **MARK 39** | Visión JARVIS Mark 1: Gesture Engine con MediaPipe Hands (5 señas), comandos de voz siempre activos ("AREX" + comando), HUD holográfico translúcido (telemetría, guía de gestos, barra de voz, grid de módulos, flash de gesto) |
| **MARK 40** | Gesture Engine Mark 2: swipe (navegar módulos), pinch-to-click, partículas + háptica + audio, estela y cursor; saludos proactivos por módulo, badges de urgencia, indicador de habla animado, contexto cross-módulo en prompts de visión |
| **MARK 41** | Escaneo de recibos → gasto automático (extracción IA), swipe en tarjetas de tareas (completar/borrar), Parallax Engine (profundidad holográfica por giroscopio/puntero), README al corriente |
| **MARK III** | Rediseño visual completo del sistema: orbe 3D WebGL con GLSL shaders (Fresnel rim, wave displacement, plasma energy bands), tipografía Exo 2 + JetBrains Mono, corner brackets holográficos en paneles, glassmorphism mejorado, escanlines en HUD, chat bubbles holográficos, grilla de fondo en módulos, glow en dock activo, acento animado, colores de acento por módulo, SW v57 |
| **MARK IV** | Visión JARVIS-interactivo + Rediseño 3D holográfico + Vision Workspace + Translucencia total (SW v61–63); Neural Orb Engine: nueva `neural-orb.js` con Canvas 2D — agentes IA en Mission Control renderizados como esferas neurales tipo Ultron/JARVIS: 26 nodos distribuidos en superficie esférica (espiral Fibonacci), ~40 conexiones tipo sinapsis, pulsos de energía que viajan por las conexiones con trail degradado y halo de cabeza, nodo con halo ambiente pulsante, espectáculo de luz especular (reflejo de ventana), glow atmosférico exterior que respira, clip mask esférico, profundidad por z-sort; estados completamente distintos: idle (respira lento, pocos pulsos), active (pulsos frecuentes), thinking (pulso rápido 0.065Hz + ráfaga de 8 pulsos al activar), speaking (ondulación 0.12Hz + burst de 10 pulsos + anillo de actividad); click ejecuta agente (thinking 3.5s → estado real) + navega módulo; SW v64 |

---

*Construido por Alexiz — laboratorio personal de IA.*
