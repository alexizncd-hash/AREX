# AREX — Sistema de Inteligencia Personal · MARK IV (v67)

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
├── vision.js           → Visión MARK IV: análisis IA, gestos personalizables, voz, HUD módulos (sin salir de cámara), tarea/gasto por voz
├── gesture.js          → Gesture Engine (MediaPipe Hands): señas, swipe, pinch, cursor, partículas
├── parallax.js         → Parallax Engine: profundidad holográfica vía giroscopio / puntero
├── holo.js             → Holo Engine: capa 3D holográfica interactiva estilo Stark (aditiva)
├── webxr.js            → Soporte AR experimental (WebXR, fase 3)
├── sw.js               → Service Worker v58 (PWA / modo offline / cache network-first)
├── manifest.json       → Manifest PWA (instalable en móvil/escritorio)
├── icon.svg            → Ícono de la aplicación
├── config.js           → API keys locales (gitignored — NUNCA se sube al repo)
├── config.example.js   → Plantilla de configuración para nuevos dispositivos
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
| **NEGOCIO** | 🫘 | Gestión del negocio de frijol mayocoba: inventario, ventas por medio litro, sucursales, reparto, gastos, meta mensual, gráfica 7 días |
| **GASTOS** | 💸 | Gastos personales diarios por categoría con presupuesto mensual y comparativa visual |
| **METAS** | 🎯 | Objetivos con progreso (numérico o porcentaje), fecha límite y categorías |
| **PROYECTOS** | ▣ | Proyectos personales con fases, estado y seguimiento |
| **CTRL** | ⊡ | Mission Control: telemetría del sistema, bitácora de eventos, panel de agentes multi-IA |
| **REPARTO** | 📍 | Rutas de Reparto: mapa 3D interactivo, geolocalización, clima en tiempo real, marcadores de sucursales, rutas guardadas |

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JS puro | Interfaz completa sin frameworks ni bundlers |
| Groq API — llama-3.3-70b-versatile | Motor de IA principal: chat, razonamiento, briefing |
| Groq Vision — llama-4-maverick / scout | Análisis de imágenes (Visión y chat; fallback si no hay Gemini) |
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
| Neural Orb Engine v2 | Canvas 2D cerebros holográficos: Fibonacci nodes, synapse pulses, rim lighting, specular highlights |
| PWA + Service Worker v65 | Instalable, network-first para shell, cache offline |
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

> **Seguridad**: `config.js` está en `.gitignore` y nunca se commitea. Contiene credenciales reales. No compartir ni subir al repo bajo ninguna circunstancia.

---

## Changelog

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
