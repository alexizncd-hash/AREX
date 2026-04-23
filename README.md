# AREX — Sistema de Inteligencia Personal

> **AREX** es un agente de IA personal con interfaz HUD futurista (estilo JARVIS/Iron Man).  
> Su nombre nace de **Alex**iz y Marg**aret** — las dos personas más importantes en su vida.

---

## ¿Qué es AREX?

Asistente de inteligencia artificial de uso personal, construido con HTML, CSS y JavaScript puro — sin frameworks. Diseñado para estudiantes, emprendedores y desarrolladores que necesitan un sistema inteligente siempre disponible, rápido y privado.

---

## Estructura del proyecto

```
arex/
├── index.html     → Estructura HTML del HUD + modales + setup screen
├── style.css      → Diseño futurista / estética Stark Industries
├── app.js         → Motor: IA, voz, comandos, Firebase, archivos, eventos
├── sw.js          → Service Worker (PWA / modo offline)
├── manifest.json  → Manifest PWA (instalable en móvil/escritorio)
├── icon.svg       → Ícono de la aplicación
├── config.js      → API keys locales (gitignored — no se sube al repo)
└── README.md      → Este archivo
```

---

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML / CSS / JS puro | Interfaz completa sin frameworks |
| Groq API (llama-3.3-70b-versatile) | Motor de inteligencia artificial (texto) |
| Groq Vision (llama-3.2-11b-vision-preview) | Análisis de imágenes con IA |
| Firebase Firestore | Persistencia: historial, notas, estadísticas |
| Tavily Search API | Búsqueda web en tiempo real |
| Web Speech API | Reconocimiento de voz (micrófono) |
| SpeechSynthesis API | Síntesis de voz (AREX habla) |
| PDF.js (CDN) | Extracción de texto de archivos PDF |
| PWA (Service Worker) | Instalable, funciona offline parcialmente |

---

## Cómo usar

1. Abre la app en el navegador (GitHub Pages o local).
2. Si es la primera vez, ingresa tu Groq API Key en la pantalla de configuración.
3. Escribe un mensaje o usa `/ayuda` para ver todos los comandos.
4. Opcional: activa el micrófono, la búsqueda web o la voz de AREX con los botones.

> El reconocimiento de voz requiere HTTPS en producción. GitHub Pages lo provee automáticamente.

---

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `/ayuda` | Muestra todos los comandos |
| `/config` | Abre el panel para cambiar API keys (sin F12) |
| `/limpiar` | Borra el chat y el historial de Firebase |
| `/resumir` | Resume la conversación actual con IA |
| `/exportar` | Descarga la conversación como `.txt` |
| `/examen` | Activa/desactiva modo examen (respuestas detalladas) |
| `/notas` | Abre/cierra el panel de notas con categorías |
| `/memoria` | Gestiona la memoria permanente (hasta 20 entradas) |
| `/stats` | Muestra estadísticas de uso |
| `/recordar 30min estudiar` | Recordatorio en 30 minutos |
| `/recordar 2h entregar tarea` | Recordatorio en 2 horas |
| `/recordar 20:00 repasar apuntes` | Recordatorio a hora específica |

---

## Configuración de API keys

Las keys se guardan en `localStorage` del navegador (nunca se suben al repo).  
Para cambiarlas desde cualquier dispositivo, escribe `/config` en el chat.

| Key | Dónde obtenerla | ¿Requerida? |
|---|---|---|
| Groq API Key | console.groq.com | Sí |
| Tavily API Key | app.tavily.com | No (búsqueda web) |
| Firebase (6 campos) | console.firebase.google.com | No (memoria permanente) |

---

## Persistencia de datos

| Dato | ¿Persiste entre sesiones? | Dónde |
|---|---|---|
| API keys | Sí, siempre | `localStorage` |
| Historial de chat | Sí (con Firebase) | Firestore |
| Notas | Sí (con Firebase) | Firestore |
| Estadísticas de uso | Sí (con Firebase) | Firestore |
| Sin Firebase | Solo durante la sesión activa | Memoria del navegador |

---

## Roadmap

### Completado

- [x] **Fase 1** — UI futurista HUD (orb, reactor, header, footer, animaciones)
- [x] **Fase 2** — Motor de IA con Groq API (llama-3.3-70b-versatile)
- [x] **Fase 3** — Voz bidireccional (micrófono + síntesis de voz en español)
- [x] **Fase 4** — Personalidad y system prompt completo (identidad AREX)
- [x] **Fase 5** — Sistema de comandos completo (`/ayuda`, `/limpiar`, `/examen`, `/resumir`, `/exportar`, `/notas`, `/stats`, `/recordar`, `/config`)
- [x] **Fase 6** — Persistencia con Firebase Firestore (historial, notas, estadísticas)
- [x] **Fase 7** — Búsqueda web en tiempo real (Tavily)
- [x] **Fase 8** — Análisis de archivos (PDF hasta 10 páginas + imágenes con visión IA)
- [x] **Fase 9** — Panel de notas persistentes
- [x] **Fase 10** — Estadísticas de uso (mensajes, búsquedas, archivos, voz)
- [x] **Fase 11** — Modo examen (respuestas detalladas y estructuradas)
- [x] **Fase 12** — Auto-resumen de conversación al llegar a 30 mensajes
- [x] **Fase 13** — PWA instalable (Service Worker + manifest)
- [x] **Fase 14** — Setup screen + `/config` (gestión de keys desde la app, sin consola)
- [x] **Fase 15** — Renderizado de Markdown (marked.js + DOMPurify + highlight.js `atom-one-dark`)
- [x] **Fase 17** — Panel de contexto personal `/contexto` (proyectos, universidad, metas, datos fijos inyectados en cada prompt)

- [x] **Fase 18** — Comandos rápidos `/atajos` (hasta 15 atajos con soporte `{args}`, validación de nombres reservados)
- [x] **Fase 19** — Análisis automático de URLs (pegar un link = AREX extrae y resume el contenido; doble fallback Tavily extract → search)
- [x] **Fase 21** — Múltiples URLs (pegar varias URLs o URL + pregunta = análisis comparativo simultáneo)
- [x] **Fase 22** — Comandos de voz del sistema (voz activa `/limpiar`, `/examen`, `/notas`, `/exportar`, `/stats`, `/resumir`, búsqueda web)
- [x] **Fase 23** — Auto-búsqueda por contexto (AREX detecta palabras clave de datos en tiempo real y activa Tavily automáticamente)
- [x] **Fase 24** — Memoria permanente `/memoria` (hasta 20 entradas inyectadas en cada respuesta, editables desde el chat)
- [x] **Fase 25** — Notas con categorías (General, Estudio, Ideas, Trabajo, Personal) y filtro por categoría en el panel

### Próximo

- [ ] **Fase 16** — Sesiones múltiples (guardar y cambiar entre conversaciones — pendiente para etapa avanzada)
- [ ] **Fase 20** — Ventana de código en vivo (editor + preview HTML/CSS/JS en tiempo real)

---

*Construido por Alexiz — laboratorio personal de desarrollo.*
