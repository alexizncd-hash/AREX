# AREX — Sistema de Inteligencia Personal · MARK 37

> **AREX** es un agente de IA personal con interfaz HUD futurista estilo JARVIS/Iron Man.  
> Su nombre nace de **Alex**iz y Marg**aret** — las dos personas más importantes en su vida.

---

## ¿Qué es AREX?

Sistema de inteligencia personal construido con HTML, CSS y JavaScript puro — sin frameworks ni dependencias de build. Diseñado para uso cotidiano como asistente personal completo: IA conversacional, control de finanzas, negocios, metas, proyectos, visión y más. Funciona como PWA instalable en cualquier dispositivo.

Visualmente inspirado en el JARVIS de la película *Age of Ultron*: fondo negro puro con campo de estrellas animado en canvas, orbe de partículas 3D reactivo, header con pills de estado, y paleta cian sobre negro de Stark Industries.

---

## Estructura del proyecto

```
arex/
├── index.html          → Estructura HTML: HUD, header pills, modales, paneles, dock, setup screen
├── style.css           → Diseño futurista / estética Stark Industries / JARVIS
├── app.js              → Motor principal: IA, voz, comandos, tareas, recordatorios, dashboard, canvas
├── jarvis.js           → Navegación entre módulos del dock
├── orb.js              → Orbe de partículas 3D (canvas) estilo JARVIS: esfera Fibonacci, estados reactivos
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
├── vision.js           → Módulo de visión en vivo: análisis de imágenes con Gemini o Groq
├── webxr.js            → Soporte AR experimental (WebXR, fase 3)
├── sw.js               → Service Worker v37 (PWA / modo offline / cache network-first)
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
| **NEGOCIO** | 🥑 | Gestión del negocio de frijol: inventario, ventas, sucursales, gastos, meta mensual, gráfica 7 días |
| **GASTOS** | 💸 | Gastos personales diarios por categoría con presupuesto mensual y comparativa visual |
| **METAS** | 🎯 | Objetivos con progreso (numérico o porcentaje), fecha límite y categorías |
| **PROYECTOS** | ▣ | Proyectos personales con fases, estado y seguimiento |
| **CTRL** | ⊡ | Mission Control: telemetría del sistema, bitácora de eventos, panel de agentes multi-IA |

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JS puro | Interfaz completa sin frameworks ni bundlers |
| Groq API — llama-3.3-70b-versatile | Motor de IA principal: chat, razonamiento, briefing |
| Groq Vision — llama-4-scout-17b | Análisis de imágenes (fallback si no hay Gemini) |
| Gemini 1.5 Flash (Google AI) | Análisis de imágenes con visión mejorada (preferido sobre Groq vision) |
| Firebase Firestore | Historial de chat y notas en la nube con sync multi-dispositivo |
| Tavily Search API | Búsqueda web en tiempo real |
| Web Speech API | Reconocimiento de voz (input), modo continuo |
| SpeechSynthesis API | Síntesis de voz — AREX habla |
| Canvas 2D API | Orbe de partículas 3D + campo de estrellas animado en background |
| PWA + Service Worker v37 | Instalable, network-first para shell, cache offline |
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

## Orbe de partículas JARVIS

El orbe central de AREX es un sistema de partículas 3D en canvas que reacciona dinámicamente al estado del sistema, inspirado en el JARVIS de *Age of Ultron*:

- **80 partículas** distribuidas en la superficie de una esfera usando distribución de Fibonacci (cobertura uniforme orgánica)
- **Conexiones K-nearest** (K=5) entre partículas cercanas, renderizadas con depth-sorting real
- **Perspectiva 3D real** usando matrices rotateY/X/Z + proyección de perspectiva
- **Profundidad física**: partículas al frente son más grandes y brillantes; las de atrás, tenues y pequeñas
- **Núcleo central** con gradiente radial que pulsa según el estado

| Estado | Color | Comportamiento |
|--------|-------|----------------|
| En espera | Cyan | Rotación lenta y constante |
| Hablando | Blanco brillante | Rotación rápida + esfera pulsa hacia afuera (18Hz) |
| Pensando | Azul profundo | Velocidad media + giro en eje Z + oscilación del tilt |
| Escuchando | Verde | Rotación lenta + respiración suave |
| Buscando | Naranja | Rotación rápida + pulso prominente |

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

## Visión a largo plazo — Camino a Jarvis

### Lo que ya funciona
- IA conversacional con memoria, contexto y hechos aprendidos
- Voz bidireccional (input + output) con síntesis en español
- Módulos de vida completos: finanzas, tareas, notas, negocio, metas, proyectos
- Visión con cámara: análisis de imágenes en tiempo real (Gemini o Groq)
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

---

*Construido por Alexiz — laboratorio personal de IA.*
