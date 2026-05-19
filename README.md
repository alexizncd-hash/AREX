# AREX — Sistema de Inteligencia Personal

> **AREX** es un agente de IA personal con interfaz HUD futurista (estilo JARVIS/Iron Man).  
> Su nombre nace de **Alex**iz y Marg**aret** — las dos personas más importantes en su vida.

---

## ¿Qué es AREX?

Sistema de inteligencia personal construido con HTML, CSS y JavaScript puro — sin frameworks. Diseñado para uso cotidiano: chat con IA, control de finanzas personales, gestión de tareas con urgencia, editor de código en vivo, recordatorios persistentes y módulo de emergencias SOS.

---

## Estructura del proyecto

```
arex/
├── index.html          → Estructura HTML: HUD, modales, paneles, setup screen
├── style.css           → Diseño futurista / estética Stark Industries
├── app.js              → Motor: IA, voz, comandos, tareas, recordatorios, SOS, dashboard
├── jarvis.js           → Navegación entre módulos del dock
├── finanzas.js         → Lógica del módulo financiero
├── finanzas-data.js    → Datos financieros + funciones de cálculo
├── finanzas.css        → Estilos del módulo financiero
├── sw.js               → Service Worker (PWA / modo offline)
├── manifest.json       → Manifest PWA (instalable en móvil/escritorio)
├── icon.svg            → Ícono de la aplicación
├── config.js           → API keys locales (gitignored — no se sube al repo)
├── config.example.js   → Plantilla de configuración
└── README.md           → Este archivo
```

---

## Módulos del dock

| Módulo | Ícono | Descripción |
|--------|-------|-------------|
| **INICIO** | ⊞ | Dashboard: tareas urgentes, finanzas, recordatorios activos, barra del mes |
| **CHAT** | 💬 | Chat con IA (Groq), búsqueda web, análisis de archivos |
| **FIN** | $ | Finanzas personales: tarjetas, gastos, calculadora, recordatorios de pagos |
| **TAREAS** | ✓ | Tareas con fecha límite, prioridad y ordenamiento por urgencia |
| **CÓDIGO** | `</>` | Editor de código HTML/CSS/JS con preview en vivo (sandbox) |
| **SOS** | ⚠ | Emergencias: 911, contactos, GPS, SMS, WhatsApp, tarjeta médica |

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JS puro | Interfaz completa sin frameworks |
| Groq API (llama-3.3-70b-versatile) | Motor de inteligencia artificial |
| Groq Vision (llama-3.2-11b-vision-preview) | Análisis de imágenes con IA |
| Firebase Firestore | Persistencia: historial de chat y notas |
| Tavily Search API | Búsqueda web en tiempo real |
| Web Speech API | Reconocimiento de voz |
| SpeechSynthesis API | Síntesis de voz (AREX habla) |
| PDF.js | Extracción de texto de archivos PDF |
| PWA (Service Worker) | Instalable, funciona offline parcialmente |

---

## Cómo usar

1. Abre la app en el navegador (GitHub Pages o local).
2. Si es la primera vez, ingresa tu Groq API Key en la pantalla de configuración.
3. Escribe un mensaje o usa `/ayuda` para ver todos los comandos disponibles.
4. Configura el módulo SOS con tus contactos de emergencia y datos médicos.
5. Opcional: activa micrófono, búsqueda web o voz con los botones del header.

> El reconocimiento de voz requiere HTTPS en producción. GitHub Pages lo provee automáticamente.

---

## Comandos disponibles

### Chat y sistema

| Comando | Descripción |
|---|---|
| `/ayuda` | Lista todos los comandos disponibles |
| `/config` | Cambia API keys desde la app |
| `/limpiar` | Borra el chat y el historial de Firebase |
| `/resumir` | Resume la conversación actual con IA |
| `/exportar` | Descarga la conversación como `.txt` |
| `/examen` | Activa/desactiva modo examen (respuestas detalladas) |
| `/notas` | Abre el panel de notas con categorías |
| `/memoria` | Gestiona la memoria permanente (hasta 20 entradas) |
| `/stats` | Estadísticas de uso (mensajes, búsquedas, archivos, voz) |
| `/contexto` | Edita el perfil personal (proyectos, universidad, metas) |
| `/atajos` | Gestiona atajos de comandos personalizados |
| `/run` | Abre el último código generado en el panel de preview |

### Tareas

| Comando | Descripción |
|---|---|
| `/tarea descripción` | Agrega tarea con prioridad media, sin fecha |
| `/tarea texto !alta` | Tarea con prioridad alta (también `!media`, `!baja`) |
| `/tarea texto @2026-05-25` | Tarea con fecha límite |
| `/tarea texto !alta @2026-05-25` | Tarea con prioridad y fecha combinadas |

### Recordatorios

| Comando | Descripción |
|---|---|
| `/recordar 30min mensaje` | Recordatorio en 30 minutos |
| `/recordar 2h mensaje` | Recordatorio en 2 horas |
| `/recordar 20:00 mensaje` | Recordatorio a una hora específica |
| `/recordar` | Lista todos los recordatorios activos con countdown |

> Los recordatorios son **persistentes**: se guardan en localStorage y se recuperan automáticamente al recargar la página. Si la app estaba cerrada cuando venció uno, aparece como "perdido" en el dashboard.

---

## Módulo SOS — Emergencias

El módulo SOS está diseñado para funcionar en situaciones de emergencia con y sin internet:

**Sin internet (solo señal celular):**
- Botón 911 → llama directamente al 911
- SMS a contactos con mensaje pre-redactado + ubicación
- Mensaje copiable al portapapeles

**Con internet:**
- WhatsApp a contactos con coordenadas GPS exactas + link de Google Maps
- Obtención de ubicación GPS precisa (±metros)

**Siempre visible:**
- Tarjeta médica: sangre, alergias, medicamentos, condiciones
- Ubicación de referencia: Hermosillo, Sonora como fallback

**Configuración inicial recomendada:** abrir el módulo SOS → ⚙ CONFIGURAR → agregar contactos de emergencia y datos médicos.

---

## Módulo de Tareas

- Prioridad: Alta (🔴), Media (🟡), Baja (🟢) con selector visual
- Fecha límite con date picker — indicador de días restantes con código de color
- Ordenamiento automático: vencidas → hoy → próximas → sin fecha
- Borde lateral de color por urgencia en cada tarea
- Badge del dock se vuelve rojo cuando hay tareas vencidas o que vencen hoy

---

## Módulo de Finanzas

- Dashboard con tarjetas de crédito, saldos y gráfica de gastos
- Recordatorios de pagos próximos (0-7-30 días)
- Calculadora de liquidación de deuda (estrategia avalancha/bola de nieve)
- Editor de datos: actualiza saldos, pagos mínimos, intereses e ingresos
- Análisis con IA: envía snapshot financiero completo al chat para análisis

---

## Persistencia de datos

| Dato | Dónde | Key de localStorage |
|---|---|---|
| API keys | localStorage | `arex_config` |
| Historial de chat | Firebase Firestore | — |
| Notas | Firebase Firestore | — |
| Tareas | localStorage | `arex_tareas` |
| Recordatorios | localStorage | `arex_recordatorios` |
| Finanzas (overrides) | localStorage | `arex_finanzas_overrides` |
| Memoria permanente | localStorage | `arex_memoria` |
| Atajos personalizados | localStorage | `arex_atajos` |
| Contexto personal | localStorage | `arex_context` |
| Sesiones de chat | localStorage | `arex_sessions` |
| Contactos y datos SOS | localStorage | `arex_sos` |

---

## Configuración de API keys

Las keys se guardan en `localStorage` (nunca se suben al repo).  
Para cambiarlas desde cualquier dispositivo: `/config` en el chat.

| Key | Dónde obtenerla | ¿Requerida? |
|---|---|---|
| Groq API Key | console.groq.com | Sí |
| Tavily API Key | app.tavily.com | No (búsqueda web) |
| Firebase (6 campos) | console.firebase.google.com | No (notas e historial en la nube) |

---

## Historial de desarrollo

- **Fase 1-5** — UI futurista HUD + motor IA + voz + comandos base
- **Fase 6-10** — Firebase + búsqueda web + PDF + imágenes + estadísticas
- **Fase 11-15** — Modo examen + PWA + setup screen + Markdown + contexto personal
- **Fase 16** — Sesiones múltiples (guardar y cambiar entre conversaciones)
- **Fase 17-19** — Atajos personalizados + análisis de URLs + auto-búsqueda por contexto
- **Fase 20** — Panel de código en vivo (iframe sandbox, editor, `/run`, botón en dock)
- **Fase 21-25** — Múltiples URLs + voz del sistema + auto-búsqueda + memoria permanente + notas con categorías
- **Fase 26** — Módulo Finanzas: dashboard tarjetas, gráficas, calculadora, editor de datos
- **Fase 27** — Dock lateral + módulo Tareas con badge de pendientes
- **Fase 28** — Sesiones múltiples + selector de sesión en sidebar
- **Fase 29** — Tareas con fecha límite, prioridad y ordenamiento por urgencia
- **Fase 30** — Dashboard INICIO: resumen de tareas, finanzas, recordatorios y barra del mes
- **Fase 31** — Recordatorios persistentes: sobreviven recargas, countdown en vivo, widget en dashboard
- **Fase 32** — Módulo SOS: emergencias con 911, GPS, SMS, WhatsApp, tarjeta médica

---

*Construido por Alexiz — laboratorio personal de desarrollo.*
