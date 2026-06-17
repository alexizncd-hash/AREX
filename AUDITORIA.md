# AREX — Auditoría de versiones

## v89 — Rediseño Neural (2026-06-17)

### Reactor 3D
- Núcleo neural: esferas fibonacci, LineSegments, 4 anillos + ring segmentado
- Pulsos sinápticos: viajan por conexiones, saltan aleatoriamente
- Nebulosa bicolor: cyan → violeta, 900/1800 partículas
- FPS adaptativo: 60fps activo, 30fps idle, pausa total módulo no-INICIO
- WebGL fallback: orb.js si no hay soporte

### Centros de navegación
| Centro  | Módulos |
|---------|---------|
| CAPITAL | finanzas, gastos, negocio, reparto |
| IMPULSO | metas, tareas, agenda, habitos |
| MENTE   | notas, evidencias, proyectos |
| CONTROL | control |

### Cerebros IA
| Función | Cerebro | Modelo |
|---------|---------|--------|
| Chat principal (callGroq) | CORE | llama-3.3-70b-versatile |
| _analizarConArex | CORE | llama-3.3-70b-versatile |
| _autoSummarizeSession | RÁPIDO | llama-3.1-8b-instant |
| generarBriefing | RÁPIDO | llama-3.1-8b-instant |
| analizarGastos | RÁPIDO | llama-3.1-8b-instant |

### Tipografía
- --font: Rajdhani (sans-serif HUD)
- --font-mono: Share Tech Mono (datos, labels)
