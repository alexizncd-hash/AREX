/* ═══════════════════════════════════════════════════════
   app.js — Lógica de interfaz de AREX
   Conecta la UI con el cerebro (jarvis.js)
═══════════════════════════════════════════════════════ */

// ── Referencias a elementos del DOM ─────────────────────
const chatPanel   = document.getElementById("chat-panel");
const userInput   = document.getElementById("user-input");
const btnSend     = document.getElementById("btn-send");
const btnMic      = document.getElementById("btn-mic");
const orb         = document.getElementById("orb");
const arexStatus  = document.getElementById("arex-status");
const clock       = document.getElementById("clock");

/* ════════════════════════════════════════════════════════
   RELOJ en tiempo real (esquina superior derecha)
════════════════════════════════════════════════════════ */
function updateClock() {
  const now = new Date();
  const h   = String(now.getHours()).padStart(2, "0");
  const m   = String(now.getMinutes()).padStart(2, "0");
  const s   = String(now.getSeconds()).padStart(2, "0");
  clock.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ════════════════════════════════════════════════════════
   ESTADOS DEL SISTEMA
════════════════════════════════════════════════════════ */
function setStatus(state, text) {
  arexStatus.textContent = text;
  orb.classList.remove("speaking", "listening", "thinking");
  if (state) orb.classList.add(state);
}

/* ════════════════════════════════════════════════════════
   RENDERIZAR MENSAJES en el chat
════════════════════════════════════════════════════════ */
function addMessage(sender, text) {
  const welcome = chatPanel.querySelector(".chat-welcome");
  if (welcome) welcome.remove();

  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${sender}`;

  msgDiv.innerHTML = `
    <span class="sender">${sender === "user" ? "TÚ" : "AREX"}</span>
    <div class="bubble">${escapeHTML(text)}</div>
  `;

  chatPanel.appendChild(msgDiv);
  chatPanel.scrollTop = chatPanel.scrollHeight;

  return msgDiv;
}

function addThinkingIndicator() {
  const welcome = chatPanel.querySelector(".chat-welcome");
  if (welcome) welcome.remove();

  const thinkDiv = document.createElement("div");
  thinkDiv.className = "msg arex thinking";
  thinkDiv.id = "thinking-indicator";

  thinkDiv.innerHTML = `
    <span class="sender">AREX</span>
    <div class="bubble">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  `;

  chatPanel.appendChild(thinkDiv);
  chatPanel.scrollTop = chatPanel.scrollHeight;
}

function removeThinkingIndicator() {
  const indicator = document.getElementById("thinking-indicator");
  if (indicator) indicator.remove();
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

/* ════════════════════════════════════════════════════════
   FLUJO PRINCIPAL: Procesar mensaje del usuario
════════════════════════════════════════════════════════ */
async function handleUserMessage(text) {
  if (!text.trim()) return;

  addMessage("user", text);
  userInput.value = "";

  setStatus("thinking", "Procesando…");
  addThinkingIndicator();

  const reply = await window.AREX.askARex(text);

  removeThinkingIndicator();
  addMessage("arex", reply);

  setStatus("speaking", "Transmitiendo respuesta");
  const utterance = window.AREX.arexSpeak(reply);

  utterance.onend = () => {
    setStatus(null, "En espera de instrucciones");
  };

  window.speechSynthesis.speak(utterance);
}

/* ════════════════════════════════════════════════════════
   EVENTOS DE INTERFAZ
════════════════════════════════════════════════════════ */
btnSend.addEventListener("click", () => {
  handleUserMessage(userInput.value);
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleUserMessage(userInput.value);
  }
});

btnMic.addEventListener("click", async () => {
  if (btnMic.classList.contains("listening")) return;

  btnMic.classList.add("listening");
  setStatus("listening", "Escuchando…");

  try {
    const transcript = await window.AREX.listenToUser();
    btnMic.classList.remove("listening");

    if (transcript) {
      userInput.value = transcript;
      handleUserMessage(transcript);
    } else {
      setStatus(null, "No se detectó audio");
    }

  } catch (error) {
    btnMic.classList.remove("listening");
    setStatus(null, "Error de micrófono");
    console.error(error);
  }
});

/* ════════════════════════════════════════════════════════
   INICIO DEL SISTEMA
════════════════════════════════════════════════════════ */
window.addEventListener("load", () => {
  userInput.focus();

  window.speechSynthesis.onvoiceschanged = () => {
    console.log("AREX: Síntesis de voz lista.");
  };
});
