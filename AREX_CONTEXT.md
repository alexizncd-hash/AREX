# AREX — Contexto completo del proyecto

## ¿Qué es AREX?
AREX es un sistema operativo de inteligencia personal estilo J.A.R.V.I.S (Iron Man), desplegado como PWA en GitHub Pages. El usuario principal es Alexiz, estudiante universitario con un negocio de aguacates. Lo usa desde **Meta Quest 3S en modo AR/passthrough** y desde móvil Android.

**Repo:** `alexizncd-hash/AREX` (GitHub Pages, rama `main` para producción)  
**Rama de desarrollo activa:** `claude/repo-assistance-7Vpbm`  
**URL de producción:** se despliega automáticamente desde `main`  
**config.js:** GITIGNOREADO — contiene API keys reales. Nunca tocar ni commitear.

---

## Stack técnico
- **Frontend:** HTML/CSS/JS vanilla — sin frameworks, sin bundlers
- **Módulos JS:** `app.js` usa `type="module"` (ES6); el resto son scripts globales
- **IA:** Groq API (`llama-3.3-70b-versatile`) para chat, streaming habilitado
- **Búsqueda web:** Tavily API (opcional, activable por toggle)
- **Base de datos:** Firebase Firestore — historial de chat, notas, configuración, sync de módulos
- **Service Worker:** `sw.js` — actualmente v25, network-first para shell files
- **Librerías CDN:** highlight.js (syntax highlight en chat)
- **Sin npm, sin node_modules**

---

## API Keys y configuración
Todas las API keys se guardan en `localStorage` bajo la clave `arex_config`:
```json
{
  "groqKey": "...",
  "tavilyKey": "...",
  "owmKey": "...",
  "firebase": { "apiKey": "...", "projectId": "...", ... }
}
```
**Prioridad de carga:** `config.js` (desarrollo local) → `localStorage` → pantalla de setup

---

## Módulos activos
| Módulo | Archivo | Storage key |
|--------|---------|-------------|
| Chat IA | `app.js` | `arex_sessions`, `arex_history_*` |
| Finanzas | `finanzas.js` + `finanzas-data.js` | `arex_finanzas` |
| Negocio (aguacates) | `negocio.js` | `arex_negocio` |
| Gastos personales | `gastos.js` | `arex_gastos_personal` |
| Metas | `metas.js` | `arex_metas` |
| Tareas | dentro de `app.js` | `arex_tareas` |
| Notas | dentro de `app.js` | `arex_notas` |
| Dashboard/Inicio | dentro de `app.js` | — |

**Módulos eliminados** (ya no existen): Salud, Agenda, Hábitos, SOS, Código

---

## Arquitectura de archivos
```
AREX/
├── index.html          # Shell PWA, dock de navegación, modales
├── style.css           # Estilos globales (paleta cyan #00d4ff + negro)
├── app.js              # Motor principal (type="module")
├── jarvis.js           # Navegación entre módulos (AREXNav)
├── sw.js               # Service Worker v25
├── manifest.json       # PWA manifest
├── icon.svg            # Icono
├── finanzas.js         # Módulo finanzas
├── finanzas.css
├── finanzas-data.js    # Funciones de datos financieros
├── negocio.js          # Módulo negocio (aguacates)
├── negocio.css
├── gastos.js           # Módulo gastos personales
├── gastos.css
├── metas.js            # Módulo metas
├── metas.css
└── config.js           # GITIGNOREADO — API keys reales
```

---

## Sistema de voz (app.js)

### Síntesis (`voiceOn`)
- `arexSpeak(text)` — usa `SpeechSynthesisUtterance`, voz masculina española
- Se activa con el toggle **VOZ DE AREX** en sidebar o botón en toolbar
- Variable global: `let voiceOn = false`

### Reconocimiento one-shot
- `startListening()` — toca micrófono → habla → procesa → fin
- Detecta comandos de voz (ver `VOICE_CMDS`) y mensajes normales

### Modo AR — Voz Continua (Fase 2, recién implementado)
- Variable: `let continuousMode = false`
- `toggleContinuousMode()` — activa/desactiva desde sidebar toggle "MODO AR"
- `startContinuousMode()` — `SpeechRecognition` en modo `continuous: true`
- **Wake word:** detecta `"AREX"` en el transcript → procesa lo que sigue como comando
- Auto-restart 300ms después de que el reconocimiento se detiene
- Pausa escucha mientras AREX habla (anti-feedback loop), reanuda 700ms después
- Guards: `isBusy` e `isSpeaking` evitan comandos simultáneos
- `arexSpeak` funciona con `voiceOn || continuousMode`
- Visual: anillos orbitales animados en el orb (CSS `::before/::after` con `.ar-active`)
- HUD indicator: `#ar-hud` — badge flotante con dot pulsante

---

## Sistema de prompts AI

### Construcción del system prompt en cada llamada a Groq:
```js
buildSystemBase()      // personalidad AREX + datos de Alexiz + módulos
+ (examMode ? EXAM_ADDON : '')
+ buildContextSection()  // contexto personal (proyectos, universidad, metas)
+ buildMemoriaSection()  // memoria permanente del usuario
+ buildModuleContext()    // DATA EN TIEMPO REAL de todos los módulos
```

### `buildModuleContext()` — datos en tiempo real
Lee localStorage y devuelve texto compacto con:
- FINANZAS: ingreso mensual, deuda total, margen, próximos pagos
- NEGOCIO: ventas/gastos/ganancia del mes, stock en kg
- GASTOS_PERSONALES: total del mes, número de transacciones
- METAS_ACTIVAS: lista de metas sin completar
- TAREAS_URGENTES: tareas vencidas o del día

### Variables de modo
```js
let voiceOn        = false;  // síntesis de voz
let searchOn       = false;  // búsqueda web Tavily
let examMode       = false;  // respuestas extensas estructuradas
let continuousMode = false;  // voz continua con wake word (Modo AR)
let isBusy         = false;  // AREX procesando — bloquea inputs
let isSpeaking     = false;  // síntesis activa
```

---

## Firebase Firestore
- Colección `arex` → doc `config` (configuración de AREX)
- Colección `arex` → doc `chat_history` (historial comprimido)
- Colección `arex_data/{key}` — sync genérico de módulos
- `arexSyncData(lsKey)` — sube cualquier key de localStorage a Firestore
- `pullAllModuleData()` — al boot, descarga datos faltantes desde Firestore

---

## Búsqueda global (Ctrl+K)
`buscarGlobal(q)` busca en:
- Tareas (texto, fecha)
- Notas (título, cuerpo)
- Hechos de memoria (texto)
- Recordatorios pendientes (mensaje)
- Metas (título, descripción)
- Gastos (concepto, categoría)
- Negocio: ventas (sucursal), gastos (concepto)

`renderBusquedaGlobal(q)` — renderiza resultados con highlight y monto formateado

---

## Recordatorios
- `/recordar 30min mensaje`, `/recordar 20:00 mensaje`
- `armReminder(rec)` — usa `setTimeout`, usa `registration.showNotification()` vía SW
- `restoreReminders()` — al boot dispara notificaciones de recordatorios perdidos
- `visibilitychange` listener — re-dispara al volver al tab

---

## Navegación entre módulos (jarvis.js)
```js
AREXNav.cambiarModulo('finanzas')  // cambia el panel activo
// Módulos: inicio, chat, finanzas, tareas, notas, negocio, gastos, metas
```
Paneles HTML: `#module-{nombre}.module-panel` — visibilidad por `.active`

---

## Paleta visual
```css
--cyan:       #00d4ff   /* color primario — todos los acentos */
--bg-dark:    #020c14   /* fondo principal */
--text-main:  #e0f4ff   /* texto principal */
--text-muted: #4a7a96   /* texto secundario */
--green:      #00ffaa   /* éxito, escuchando */
--orange:     #ff9900   /* advertencia, búsqueda */
--font:       'Courier New', monospace
```

---

## Reglas de desarrollo
1. **Nunca tocar `config.js`** ni incluirlo en commits
2. Toda función usada desde HTML debe exportarse como `window.X = X`
3. `app.js` es `type="module"` — imports de otros módulos solo si tienen `export`
4. El resto de scripts son globales (sin `type="module"`)
5. Para agregar módulo nuevo: archivo `.js` + `.css`, panel `#module-X.module-panel` en HTML, botón en dock con `data-module="X"`, caso en `jarvis.js`
6. Service Worker: incrementar versión en `sw.js` (`CACHE` + `VERSION`) en cada deploy
7. Firebase sync: llamar `arexSyncData(KEY)` dentro de cada función `save*()`
8. Mantener compatibilidad móvil — el fallback 2D siempre debe funcionar

---

## Fases AR en progreso

### Fase 1 — COMPLETA
AREX abre en Meta Browser del Quest 3S como PWA 2D normal.

### Fase 2 — COMPLETA (v25)
Voz continua con wake word "AREX". Modo AR con anillos orbitales en el orb.

### Fase 3 — PENDIENTE: WebXR AR
Paneles flotantes en espacio físico con passthrough usando WebXR Device API.
- Three.js desde CDN: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
- Paneles: métricas financieras, tareas del día, metas activas, chat por voz
- Estética: overlays azules semitransparentes, glassmorphism, bordes con glow cyan
- Hand tracking o controllers para reposicionar paneles
- Botón "ENTRAR AR" en la interfaz 2D → lanza modo inmersivo

### Fase 4 — FUTURO: Visión por computadora
Cámara del Quest → frames → Groq Vision API → AREX describe el mundo real.

---

## Contexto personal de Alexiz (para que AREX lo conozca)
- Estudiante universitario en México
- Tiene un negocio familiar de venta de aguacates
- Usa Meta Quest 3S (128GB) como dispositivo principal para AREX
- Novia: Margaret (importante en su vida)
- Quiere crecer: personal, espiritual, físico, económico y en relaciones
- Prefiere entender el "mínimo funcional" antes de profundizar
- Le gusta la estética JARVIS / Iron Man
