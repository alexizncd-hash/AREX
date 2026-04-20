# AREX — Sistema de Inteligencia Personal

> **AREX** es un agente de IA personal construido con HTML, CSS y JavaScript puro.  
> Su nombre nace de **Alexiz** y M**arex** (Margaret) — las dos personas que lo hacen posible.

-----

## ✦ ¿Qué es AREX?

AREX es un asistente de inteligencia artificial con interfaz estilo HUD futurista (inspirado en JARVIS de Tony Stark), alimentado por la API de Claude de Anthropic.

Tiene personalidad propia, habla en voz alta, escucha comandos de voz y mantiene el contexto de la conversación durante la sesión.

-----

## 🗂️ Estructura del proyecto

```
arex/
├── index.html    → Estructura HTML del HUD
├── style.css     → Diseño futurista / Stark Industries
├── jarvis.js     → Cerebro: Claude API + síntesis de voz + reconocimiento de voz
├── app.js        → Lógica de interfaz y eventos
└── README.md     → Este archivo
```

-----

## ⚙️ Tecnologías utilizadas

|Tecnología            |Uso                             |
|----------------------|--------------------------------|
|HTML / CSS / JS puro  |Interfaz completa sin frameworks|
|Claude API (Anthropic)|Motor de inteligencia artificial|
|Web Speech API        |Voz a texto (micrófono)         |
|SpeechSynthesis API   |Texto a voz (AREX habla)        |

-----

## 🚀 Cómo usar

1. Abre `index.html` directamente en el navegador **o** despliega en GitHub Pages.
1. Escribe un mensaje en el campo de texto y presiona Enter (o el botón de enviar).
1. Opcional: usa el botón del micrófono para hablarle a AREX.
1. AREX responderá en texto **y en voz**.

> ⚠️ El reconocimiento de voz requiere HTTPS en producción (GitHub Pages lo provee automáticamente).

-----

## 🧠 Personalizar a AREX

Para modificar la personalidad de AREX, edita la constante `AREX_SYSTEM_PROMPT` en `jarvis.js`.

Puedes cambiar:

- Su nombre y origen del nombre
- Su personalidad y tono
- Los valores y contexto personal que conoce de ti
- Sus frases características

-----

## 📡 Roadmap

- [x] Fase 1 — UI futurista HUD completa
- [x] Fase 2 — Conexión con Claude API
- [x] Fase 3 — Voz (habla y escucha)
- [x] Fase 4 — Personalidad y system prompt final
- [ ] Fase 5 — Comandos especiales (clima, recordatorios, etc.)
- [ ] Fase 6 — Modo oscuro / claro toggle
- [ ] Fase 7 — Persistencia de historial entre sesiones

-----

*Construido por Alexiz — laboratorio personal de desarrollo.*
