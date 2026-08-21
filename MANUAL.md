# AREX — Manual del sistema

> Mapa completo de qué tiene AREX, cómo se conecta entre sí, cómo sacarle uso real
> y qué se puede mejorar. **Cada dato salió del código, no de la memoria.**
>
> Versión documentada: **v208** · 33,571 líneas · 30 archivos JS · 14 módulos ·
> 5 agentes · 39 cruces de datos verificados · costo mensual: **$0**

---

## 1 · Qué tienes

Seis bloques temáticos. Todo en HTML, CSS y JavaScript puro: sin frameworks, sin
compilación, instalable como app y funcional sin internet.

### Núcleo de inteligencia
| Componente | Qué hace |
|---|---|
| Chat (GPT-OSS 120B) | Conversación con **todo tu contexto vivo** inyectado: finanzas, negocio, metas, tareas, memoria. Cascada automática a Llama-3.3 → 3.1 si un modelo se retira |
| `/profundo` (Gemini 2.5 Pro) | Razonamiento pesado bajo demanda. 10-30 s porque razona de verdad. Cuota diaria limitada → nunca se dispara solo |
| [`memoria.js`](memoria.js) | Memoria permanente + hechos que AREX aprende solo; se inyectan al prompt por relevancia |
| [`search.js`](search.js) | Búsqueda global (Cmd+K) sobre 8 fuentes simultáneas |

### Capital · el dinero
| Módulo | Qué hace |
|---|---|
| [`negocio.js`](negocio.js) | Frijol mayocoba: inventario en kg, ventas por medio litro, sucursales en contado o **consignación**, entregas con existencia por tienda y alerta de resurtido, meta mensual |
| [`reparto.js`](reparto.js) | Mapa 3D con tus tiendas. Registro de entregas desde el popup, **optimización del orden de paradas**, ruta solo-resurtir, navegación en Google Maps/Waze |
| [`finanzas.js`](finanzas.js) + [`finanzas-data.js`](finanzas-data.js) | Tarjetas, próximos pagos, simulador de liquidación, calculadora de 5 pestañas y **capital en la calle** (entregado sin cobrar) |
| [`gastos.js`](gastos.js) | Gasto personal por categoría vs presupuesto. Se alimenta también desde la cámara (foto del ticket) |

### Impulso · productividad
| Módulo | Qué hace |
|---|---|
| [`tareas.js`](tareas.js) | Prioridad, fecha, subtareas, recurrencia, orden automático por urgencia |
| [`metas.js`](metas.js) | Objetivos con progreso numérico o porcentual y fecha límite |
| [`agenda.js`](agenda.js) | Calendario que **agrega solo** tareas, recordatorios y metas |
| [`habitos.js`](habitos.js) | Hábitos diarios con racha y mini-calendario de 7 días |

### Mente · conocimiento
| Módulo | Qué hace |
|---|---|
| [`notas.js`](notas.js) | Notas con fijadas, colores y búsqueda; se crean también por voz |
| [`evidencias.js`](evidencias.js) | Respuestas de IA como registros permanentes. Cada corrida de agente deja tarjeta |
| [`proyectos.js`](proyectos.js) | Proyectos con fases que juntan por nombre sus tareas, metas y notas |

### Visión y AR
| Módulo | Qué hace |
|---|---|
| [`vision.js`](vision.js) | La cámara como interfaz: analiza, lee texto y recibos, identifica objetos. **Modo charla**: hablas normal, con memoria del hilo y acciones a media conversación |
| [`gesture.js`](gesture.js) | 5 señas configurables (✋ ✊ ☝ ✌ 👍), retícula orbital, swipes, pellizco |
| [`forja.js`](forja.js) | "Forja un dron" → la IA diseña el objeto 3D en vivo, anclado a tu espacio, manipulable con la mano |

### Control · centro de mando
| Componente | Qué hace |
|---|---|
| **VIGÍA** | Vigilancia proactiva que **cruza módulos** al abrir la app, sin que preguntes |
| **5 agentes** | HERMES (finanzas) · ATLAS (negocio) · SENTINEL (sistema) · SCRIBE (notas) · **ESPECTRO** (audita AREX desde adentro). Un botón los corre a todos |
| **Respaldo** | 24 claves exportables, sync a la nube, transferencia completa a otro dispositivo con un código |

---

## 2 · Cómo se conecta

**39 cruces de datos verificados en el código.** `arex_negocio` es el corazón:
casi todo lo consulta.

```mermaid
flowchart LR
  R[reparto.js]:::w --> N[(arex_negocio)]:::hub
  V[vision.js]:::w --> T[(arex_tareas)]:::hub
  V --> G[(arex_gastos_pers)]:::hub
  GA[gastos.js]:::w --> G
  N --> VG[VIGIA]:::c
  F[(arex_finanzas)]:::hub --> VG
  T --> VG
  G --> VG
  N --> AG[agentes HERMES / ATLAS]:::c
  F --> AG
  N --> IA[Chat con IA]:::c
  F --> IA
  T --> IA
  N --> D[Dashboard / Vision]:::c
  classDef hub fill:#0B7E96,stroke:#0B7E96,color:#fff
  classDef w fill:#eef1f5,stroke:#6B7A8F,color:#0F1720
  classDef c fill:#fff,stroke:#0B7E96,color:#0F1720
```

### Los cruces que más trabajan por ti

| Cruce | Qué hace |
|---|---|
| `reparto → negocio` | El popup de cada tienda muestra su existencia real y si necesita resurtido, calculado en vivo desde sus entregas y ventas (`negTiendaStats`) |
| `VIGÍA → 4 módulos` | Próximos pagos × margen × ventas de la semana → ¿te alcanza? · stock en kg × entregas del mes → ¿cubres el siguiente ciclo? |
| `negocio → finanzas` | Las ventas del mes suman a tu ingreso real; lo entregado sin cobrar aparece como capital en la calle |
| `visión → gastos` | Foto del ticket → gasto registrado en su categoría (`gpAddGastoAuto`) |
| `agenda → tareas + metas + recordatorios` | Un calendario armado de tres fuentes |
| `proyectos → tareas + metas + notas` | Cada proyecto junta por nombre lo relacionado |
| `control → todo` | Único módulo que escribe claves de todos los demás: respaldo, importación, sync forzada |

### Islas del sistema

- **`habitos.js`** — completamente aislado: ningún agente lo mira, no está en la
  búsqueda global ni en la agenda, y no expone getter para que otros lo consulten.
- **`agenda.js`** — no conoce hábitos, proyectos ni tus **pagos de tarjeta**, aunque
  `obtenerProximosPagos()` ya existe y encajaría como evento.
- **`search.js`** — no indexa negocio, reparto, hábitos, recordatorios ni memoria.

---

## 3 · Cómo usarlo de verdad

| Momento | Qué hacer |
|---|---|
| **Al despertar** (30 s) | Abre y lee. El VIGÍA ya revisó tus módulos: si algo es crítico te lo dice sin preguntar. El dashboard da negocio, finanzas, clima y pendientes de un vistazo |
| **Antes de repartir** | REPARTO → `🔥 SOLO RESURTIR` (solo tiendas que necesitan) → `⚡ OPTIMIZAR` (orden más corto, te dice cuántos km ahorras) → `▶ NAVEGAR` |
| **En la calle** | Toca la tienda en el mapa y registra la entrega ahí. Para gastos: foto del ticket. Con manos ocupadas: enciende el micrófono y **habla normal**, sin decir "AREX" |
| **Decisiones difíciles** | `/profundo <pregunta>` → Gemini 2.5 Pro con todo tu contexto. Medio minuto, pero razona en serio |
| **Semanal** (1 min) | CTRL → AGENTES → `⚡ BARRIDO TOTAL`. Los 5 agentes reportan a Evidencias; ESPECTRO audita el sistema por dentro |

**Tres atajos infrautilizados:** `Cmd+K` (busca en 8 fuentes) · decir
**"recuerda que…"** (guarda un hecho permanente) · `/hoy` (resumen del día).

---

## 4 · Hoja de ruta

Estado real, verificado en el navegador. Lo tachado se comprobó, no se supone.

### Hecho entre v213 y v220

**Bugs de datos, cerrados de raíz**
- [x] **La fecha.** 32 sitios en 12 archivos calculaban "hoy" con
      `toISOString()`, que es UTC. México va seis horas atrás, así que **a
      partir de las 18:00 todo se guardaba en el día siguiente**: una venta
      al cerrar el local, un hábito marcado de noche, el briefing del día.
      Ahora `hoy()` / `dia()` / `mes()` en `nucleo.js`. *(v216)*
- [x] **Sincronizar dejó de ser opcional.** 12 módulos tenían que acordarse
      de llamar a `arexSyncData` después de guardar. Olvidarlo dejó sin subir
      a reparto (v205), finanzas (v206) y visión (v208). Ahora va dentro de
      `guardar()`. *(v217)*
- [x] **44 diálogos nativos fuera.** `alert`/`confirm`/`prompt` se suprimen en
      la PWA de iOS. En `proyectos.js` la confirmación estaba dentro del
      `onclick`, así que el proyecto se borraba **sin preguntar**. *(v216)*
- [x] **La búsqueda global nunca encontraba tareas**: indexaba `texto` y el
      campo se llama `text` desde v208. *(v217)*
- [x] Los gastos de NEGOCIO ya cuentan en el margen real. *(v209)*
- [x] Una sola fuente de verdad para la existencia por tienda
      (`negExistenciaTienda`). *(v207)*

**Rendimiento**
- [x] **De 120 rAF/s a 0** en el dashboard. Fuera el campo de estrellas, las
      partículas y la rejilla hexagonal (dos canvas a pantalla completa), y
      fuera el tilt 3D, que se mantenía al día con un `MutationObserver`
      sobre TODO el documento — cada render de cualquier lista lo disparaba,
      y en el iPhone no hay cursor, así que nunca se vio. El orbe se queda
      pero se apaga cuando sale de pantalla. *(v215)*
- [x] CSS al arrancar: 421 → 327 KB. 303 clases muertas, 405 reglas, 24
      variables, 20 `@keyframes` y `reactor3d.*` entero. *(v218)*

**Estructura**
- [x] `nucleo.js` — la base común que no existía. *(v216)*
- [x] `widgets.js` — 579 líneas fuera de `app.js`, sin una sola dependencia
      cruzada. *(v219)*
- [x] `vision.css` — 1.060 líneas que se analizaban en cada arranque para un
      panel que solo existe al abrir la cámara. *(v218)*
- [x] `diseno.css` — sistema de diseño en CSS moderno: oklch, anidamiento
      nativo, `@container`, `:has()`. INICIO migrado. *(v220)*

### Lo siguiente, por orden

- [ ] **[ALTA · uso diario]** El CHAT tiene **24 objetivos táctiles por debajo
      de 44 px** y desborde horizontal en la barra de entrada. Medido con el
      contrato de calidad. Es la pantalla que más usas.
- [ ] **[ALTA · diseño]** Propagar `diseno.css` a los 13 módulos restantes.
      Cada uno borra sus reglas viejas al migrar: migrar borrando, no
      superponiendo.
- [ ] **[MEDIA · decisión tuya]** El cristal está apagado:
      `applyPerformanceProfile()` usa `cores || 4` con umbral `<= 4`, así que
      cualquier navegador que no exponga el dato queda marcado como equipo
      flojo. Probablemente lleva tiempo así en tu iPhone.
- [ ] **[MEDIA · decisión tuya]** `Exo 2` y `JetBrains Mono` se piden en 45
      reglas y **no se descargan nunca**. O se cargan, o se sustituyen.
- [ ] **[MEDIA · conexión]** La agenda no muestra pagos de tarjeta, aunque
      `obtenerProximosPagos()` ya existe.
- [ ] **[MEDIA · conexión]** Hábitos sigue siendo una isla: sin agente, sin
      búsqueda, sin agenda.
- [ ] **[MEDIA · función]** El vínculo proyecto ↔ tarea se **lee** en
      `proyectos.js` pero ninguna pantalla lo **escribe**. Funciona solo por
      coincidencia de nombre.
- [ ] **[BAJA · función]** La búsqueda global no indexa negocio, reparto,
      hábitos ni recordatorios.
- [ ] **[BAJA · estructura]** `app.js` sigue con 5.029 líneas. Lo que queda
      —motor de chat, comandos, arranque, sesión— está entrelazado de verdad:
      seguir partiéndolo con globales de `window` (ya hay 222) empeoraría el
      acoplamiento. El camino es convertirlo a módulos ES con `import`.

---

## Método de verificación

Todo lo documentado se comprueba en un navegador real (Chromium + Playwright,
offline, sin gastar APIs) recorriendo AREX como usuario: clicks reales, datos de
prueba, medición de resultados numéricos contra valores calculados a mano.

Desde v213 hay dos contratos automáticos, y son distintos a propósito:

**Contrato de refactor** — para cambios que NO deben alterar el aspecto.
Captura 30 propiedades de estilo y el rectángulo de ~450 elementos en los 14
módulos, antes y después. El umbral es **0 diferencias reales**; solo se
admiten las de fase de animación, que se reconocen porque cambian en la tercera
cifra decimal o en 1 px. Es lo que hizo seguro colapsar 205 selectores y borrar
303 clases sin mover un píxel.

**Contrato de rediseño** — para cambios que SÍ deben cambiar el aspecto, donde
exigir "estilo idéntico" no tendría sentido. Mide que sea correcto: contraste
WCAG calculado sobre el color realmente pintado (subiendo por los padres hasta
hallar un fondo opaco), objetivos táctiles de 44 px contando los `::before` que
amplían el área, desbordes horizontales y solapes entre tarjetas.

Más las suites por función: núcleo (17), sincronización (15), widgets (8) y el
panel de visión abierto de verdad con una cámara falsa de Chromium.
