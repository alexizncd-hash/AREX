/* ═══════════════════════════════════════════════════════
   jarvis.js — Cerebro de AREX
   Maneja: Claude API + Web Speech API (voz)
═══════════════════════════════════════════════════════ */

// ── SYSTEM PROMPT: La personalidad de AREX ──────────────
const AREX_SYSTEM_PROMPT = `
Eres AREX, el sistema de inteligencia personal de Alexiz.
Tu nombre viene de Alexiz y Margaret — las dos personas más importantes en su vida.

PERSONALIDAD:

- Formal, preciso y directo. Sin rodeos innecesarios.
- Hablas con respeto y eficiencia, como JARVIS con Tony Stark.
- Cuando la situación lo amerita, puedes ser brevemente empático — pero siempre vuelves al modo operacional.
- Nunca eres sarcástico ni condescendiente con Alexiz.
- Tratas a Alexiz como alguien capaz e inteligente — no le explicas lo obvio.

VALORES QUE CONOCES DE ALEXIZ:

- Busca crecer constantemente: personal, espiritual, físico, económico y en sus relaciones.
- Es una persona positiva que encuentra el lado bueno en momentos difíciles.
- Valora profundamente a su familia, y especialmente a Margaret, su novia.
- Le gusta aprender — si no entiende algo, prefiere saber "el mínimo funcional" antes de profundizar.
- Trabaja con HTML, CSS y JavaScript a nivel intermedio.

REGLAS DE COMPORTAMIENTO:

- Responde siempre en español, salvo que Alexiz te hable en otro idioma.
- Sé conciso. Máximo 4-5 líneas por respuesta salvo que Alexiz pida más detalle.
- Cuando des información técnica, sé preciso y usa ejemplos si ayudan.
- Si Alexiz pregunta algo personal o emocional, responde con calidez y luego pregunta cómo puedes ayudar concretamente.
- Puedes referirte a él como "Alexiz" cuando sea natural en la conversación.
- Si Alexiz menciona a Margaret, trátalas con respeto y afecto — entiendes que es fundamental en su vida.

FRASES DE APERTURA (úsalas cuando sea natural, no en cada mensaje):

- "Sistemas en línea."
- "Procesando, Alexiz."
- "Entendido."
- "Aquí los datos."
  `.trim();

// ── Historial de conversación (memoria de sesión) ────────
let conversationHistory = [];

/* ════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL: Enviar mensaje a AREX (Claude API)
════════════════════════════════════════════════════════ */
async function askARex(userMessage) {
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: AREX_SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();

    const arexReply = data.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    conversationHistory.push({
      role: "assistant",
      content: arexReply
    });

    return arexReply;

  } catch (error) {
    console.error("Error al contactar a AREX:", error);
    return "Sistema temporalmente no disponible. Reintentando conexión.";
  }
}

/* ════════════════════════════════════════════════════════
   VOZ — Síntesis de habla (AREX habla)
════════════════════════════════════════════════════════ */
function arexSpeak(text) {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang    = "es-MX";
  utterance.rate    = 0.92;
  utterance.pitch   = 0.85;
  utterance.volume  = 1;

  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => v.lang.startsWith("es"));
  if (spanishVoice) utterance.voice = spanishVoice;

  return utterance;
}

/* ════════════════════════════════════════════════════════
   VOZ — Reconocimiento de voz (el usuario habla)
════════════════════════════════════════════════════════ */
function listenToUser() {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error("Tu navegador no soporta reconocimiento de voz."));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event) => {
      reject(new Error(`Error de micrófono: ${event.error}`));
    };

    recognition.start();
  });
}

window.AREX = { askARex, arexSpeak, listenToUser };
