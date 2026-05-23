# AREX — Sistema de Inteligencia Personal

> **AREX** es un agente de IA personal con interfaz HUD futurista (estilo JARVIS/Iron Man).  
> Su nombre nace de **Alex**iz y Marg**aret** — las dos personas más importantes en su vida.

---

## ¿Qué es AREX?

Sistema de inteligencia personal construido con HTML, CSS y JavaScript puro — sin frameworks ni dependencias de build. Diseñado para uso cotidiano como asistente personal completo: IA conversacional, control de finanzas, negocios, metas, emergencias, código en vivo y más. Funciona como PWA instalable en cualquier dispositivo.

---

## Estructura del proyecto

```
arex/
├── index.html          → Estructura HTML: HUD, modales, paneles, dock, setup screen
├── style.css           → Diseño futurista / estética Stark Industries
├── app.js              → Motor principal: IA, voz, comandos, tareas, recordatorios, SOS, dashboard
├── jarvis.js           → Navegación entre módulos del dock
├── finanzas.js         → Lógica del módulo financiero
├── finanzas-data.js    → Datos financieros + funciones de cálculo
├── finanzas.css        → Estilos del módulo financiero
├── negocio.js          → Módulo de gestión del negocio personal (frijol)
├── negocio.css         → Estilos del módulo negocio
├── gastos.js           → Módulo de gastos personales con presupuesto por categoría
├── gastos.css          → Estilos del módulo gastos
├── metas.js            → Módulo de metas y objetivos personales
├── metas.css           → Estilos del módulo metas
├── sw.js               → Service Worker v17 (PWA / modo offline / cache)
├── manifest.json       → Manifest PWA (instalable en móvil/escritorio)
├── icon.svg            → Ícono de la aplicación
├── config.js           → API keys locales (gitignored — nunca se sube al repo)
├── config.example.js   → Plantilla de configuración para nuevos dispositivos
└── README.md           → Este archivo
```

---

## Módulos del dock

| Módulo | Descripción |
|--------|-------------|
| **INICIO** | Dashboard: stock del negocio, tareas urgentes, finanzas, hábitos del día, recordatorios activos |
| **CHAT** | Chat con IA (Groq), búsqueda web, análisis de archivos PDF e imágenes, comandos de voz |
| **FINANZAS** | Tarjetas de crédito, saldos, gráficas de gastos, calculadora de deuda, recordatorios de pagos |
| **TAREAS** | Gestión de tareas con prioridad y fecha límite, ordenamiento automático por urgencia |
| **NOTAS** | Notas por categoría (General, Estudio, Ideas, Trabajo, Personal) con búsqueda |
| **HÁBITOS** | Tracker diario con racha, puntos de los últimos 7 días y widget en el dashboard |
| **SOS** | Emergencias: 911, GPS automático, SMS, WhatsApp, tarjeta médica, contactos de emergencia |
| **NEGOCIO** | Gestión del negocio de frijol: inventario, ventas, sucursales, gastos, gráfica, meta mensual |
| **GASTOS** | Gastos personales diarios por categoría con presupuesto mensual y comparativa visual |
| **METAS** | Objetivos personales con progreso, fecha límite y categorías (Personal, Negocio, Salud...) |
| **CÓDIGO** | Editor HTML/CSS/JS con preview en vivo en sandbox iframe |

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JS puro | Interfaz completa sin frameworks ni bundlers |
| Groq API — llama-3.3-70b-versatile | Motor de IA para chat y razonamiento |
| Groq Vision — llama-4-scout-17b-16e | Análisis de imágenes con IA |
| Firebase Firestore | Historial de chat y notas en la nube |
| Tavily Search API | Búsqueda web en tiempo real |
| Web Speech API | Reconocimiento de voz (input) |
| SpeechSynthesis API | Síntesis de voz — AREX habla (activar con botón 🔊) |
| PWA + Service Worker v17 | Instalable, network-first para shell, offline parcial |
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
| `/ayuda` | Lista todos los comandos (con scroll) |
| `/limpiar` | Borra el chat y el historial de Firebase |
| `/resumir` | Resume la conversación activa con IA |
| `/exportar` | Descarga la conversación como `.txt` |
| `/examen` | Activa/desactiva modo examen (respuestas detalladas) |
| `/briefing` | Genera el resumen del día: clima, agenda y estado del sistema |

### Herramientas
| Comando | Descripción |
|---|---|
| `/notas` | Abre el panel de notas por categoría |
| `/memoria` | Gestiona la memoria permanente (hasta 20 entradas) |
| `/hechos` | Lista los hechos aprendidos automáticamente por AREX |
| `/hechos borrar N` | Elimina el hecho número N de la lista |
| `/stats` | Estadísticas de uso (mensajes, búsquedas, archivos, voz) |
| `/contexto` | Edita el perfil personal (proyectos, universidad, metas) |
| `/atajos` | Crea y gestiona comandos rápidos personalizados |
| `/config` | Cambia API keys y configuración desde la app |
| `/buscar` | Búsqueda global en todos los módulos |
| `/buscar texto` | Busca directamente el texto ingresado |
| `/run` | Abre el último código generado en el panel de preview |
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

## Módulo Negocio (Frijol)

Gestión completa del negocio personal de venta de frijol en medios litros:

- **Dashboard**: KPIs del mes (stock, ventas, ganancia, sucursales), barra de meta mensual, gráfica de ventas de los últimos 7 días, actividad reciente
- **Ventas**: registrar con sucursal/cantidad/precio/fecha, historial con editar y borrar
- **Inventario**: stock actual en kg, entradas de producto, historial de movimientos con delete, corrección manual de stock
- **Sucursales**: puntos de venta con métricas del mes, estado activa/pausada, editar y borrar
- **Gastos**: gastos del negocio por tipo (materia prima, empaque, transporte, otro) con editar y borrar
- **Config**: precio de venta, costo por kg, rendimiento, costo de empaque, meta mensual de ventas — con calculadora de rentabilidad en tiempo real

---

## Módulo SOS — Emergencias

Diseñado para funcionar en situaciones de emergencia con y sin internet:

**Sin internet (solo señal celular):**
- Botón 911 → llamada directa al 911
- SMS a contactos con mensaje pre-redactado + ubicación de referencia
- Mensaje copiable al portapapeles

**Con internet:**
- WhatsApp a contactos con coordenadas GPS exactas + link de Google Maps
- GPS se activa automáticamente al abrir el módulo

**Siempre visible:**
- Tarjeta médica: tipo de sangre, alergias, medicamentos, condiciones
- Ubicación de referencia: Hermosillo, Sonora como fallback

---

## Persistencia de datos

| Dato | Almacenamiento | Key |
|---|---|---|
| API keys | localStorage | `arex_config` |
| Historial de chat | Firebase Firestore | — |
| Sesiones de chat | localStorage | `arex_sessions` |
| Tareas | localStorage | `arex_tareas` |
| Recordatorios | localStorage | `arex_recordatorios` |
| Notas | Firebase Firestore | — |
| Hechos aprendidos | localStorage | `arex_hechos` |
| Memoria permanente | localStorage | `arex_memoria` |
| Atajos personalizados | localStorage | `arex_atajos` |
| Contexto personal | localStorage | `arex_context` |
| Hábitos | localStorage | `arex_habitos` |
| Finanzas (overrides) | localStorage | `arex_finanzas_overrides` |
| Contactos y datos SOS | localStorage | `arex_sos` |
| Negocio (frijol) | localStorage | `arex_negocio` |
| Gastos personales | localStorage | `arex_gastos_pers` |
| Metas/objetivos | localStorage | `arex_metas` |
| Tipo de cambio (caché) | localStorage | `arex_fx_cache` |
| Briefing del día | localStorage | `arex_briefing_date` |

---

## Configuración de API keys

Las keys se guardan en `localStorage` (nunca se suben al repo).  
Para configurarlas desde cualquier dispositivo: `/config` en el chat.

| Key | Dónde obtenerla | Requerida |
|---|---|---|
| Groq API Key | console.groq.com | **Sí** |
| Tavily API Key | app.tavily.com | No — habilita búsqueda web |
| OpenWeatherMap API Key | openweathermap.org | No — habilita widget de clima |
| Firebase (6 campos) | console.firebase.google.com | No — habilita historial en la nube |

---

## Visión a largo plazo — Camino a Jarvis

AREX está construido progresivamente hacia un asistente personal de nivel Jarvis. Estado actual vs objetivos:

### Lo que ya funciona
- IA conversacional con memoria, contexto y hechos aprendidos
- Voz bidireccional (input + output) con síntesis en español
- Módulos de vida completos: finanzas, tareas, hábitos, negocio, metas
- PWA instalable, funciona parcialmente sin internet
- Auto-búsqueda cuando el contexto lo requiere

### Próximas fases
- **Salud**: agua diaria, sueño, ejercicio, peso con gráficas históricas
- **Agenda/Calendario**: eventos, citas, vencimientos conectados con tareas
- **Sincronización total**: Firebase para todos los módulos (actualmente solo chat/notas)
- **Notificaciones push inteligentes**: hábitos pendientes, tareas próximas a vencer
- **Reportes del negocio**: resumen semanal/mensual exportable a PDF o WhatsApp
- **Kanban**: vista alternativa para tareas (Pendiente / En proceso / Hecho)
- **Ollama + MacBook**: IA local completamente offline, sin dependencia de APIs de terceros

### Visión Jarvis completa (largo plazo)
- Wake word — activación por voz sin tocar la pantalla
- Modo ambient — AREX proactivo: "tienes 3 tareas para hoy", "stock bajo de frijol"
- Integración con dispositivos del hogar (smart home)
- Meta Quest 3S — panel holográfico en AR
- Knowledge graph personal — conexiones automáticas entre notas, tareas y hechos
- Multi-agente — AREX delega subtareas a agentes especializados

---

## Historial de desarrollo

- **Fase 1-5** — UI futurista HUD + motor IA + voz + comandos base
- **Fase 6-10** — Firebase + búsqueda web + PDF + imágenes + estadísticas
- **Fase 11-15** — Modo examen + PWA + setup screen + Markdown + contexto personal
- **Fase 16** — Sesiones múltiples de chat
- **Fase 17-19** — Atajos + análisis de URLs + auto-búsqueda por contexto
- **Fase 20** — Panel de código en vivo (iframe sandbox, editor, `/run`)
- **Fase 21-25** — Voz del sistema + auto-búsqueda + memoria permanente + notas con categorías
- **Fase 26** — Módulo Finanzas: dashboard de tarjetas, gráficas, calculadora
- **Fase 27** — Dock lateral + módulo Tareas con badge de urgencia
- **Fase 28** — Sesiones múltiples + selector en sidebar
- **Fase 29** — Tareas con fecha límite, prioridad y ordenamiento automático
- **Fase 30** — Dashboard INICIO con resumen de todos los módulos
- **Fase 31** — Recordatorios persistentes con countdown y widget en dashboard
- **Fase 32** — Módulo SOS: emergencias con GPS, 911, SMS, WhatsApp, tarjeta médica
- **Fase 33** — Módulo Hábitos: tracker diario con racha y widget en dashboard
- **Fase 34** — Dock móvil (barra inferior fija), safe area insets, touch targets
- **Fase 35** — Panel de código mejorado: canvas responsivo, corrección de coordenadas, patrones de referencia IA
- **Fase 36** — Módulo Negocio (Frijol): inventario, ventas, sucursales, gastos, configuración de precios
- **Fase 37** — Negocio: editar/borrar en ventas, sucursales y gastos; corrección de stock; gráfica 7 días; meta mensual
- **Fase 38** — Módulo Gastos Personales: categorías, presupuesto mensual, historial con editar/borrar
- **Fase 39** — Módulo Metas/Objetivos: progreso por tipo numérico o porcentaje, fecha límite, logradas
- **Fase 40** — Auditorías de código: 5 bugs críticos corregidos en app.js (null access Groq + speech), /ayuda actualizado con scroll

---

*Construido por Alexiz — laboratorio personal de IA.*
