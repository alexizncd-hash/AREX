// AREX — Mission Control
const BITACORA_KEY = 'arex_bitacora';
let _ctrlView      = 'telemetria';
let _logFilter     = 'todos';
let _ctrlBootTime  = Date.now();

/* ── Bitácora ─────────────────────────────────────────── */
function logBitacora(modulo, accion) {
  const arr = _getBitacora();
  arr.unshift({ ts: Date.now(), modulo: modulo || 'sistema', accion });
  if (arr.length > 500) arr.splice(500);
  localStorage.setItem(BITACORA_KEY, JSON.stringify(arr));
  // Re-render log if control module is visible
  const logEl = document.getElementById('ctrl-log-body');
  const ctrlPanel = document.getElementById('module-control');
  if (logEl && (ctrlPanel?.classList.contains('active') || ctrlPanel?.classList.contains('drawer-open'))) {
    _renderLog(logEl);
  }
}

function _getBitacora() {
  try { return JSON.parse(localStorage.getItem(BITACORA_KEY) || '[]'); } catch { return []; }
}

/* ── Telemetría ──────────────────────────────────────── */
function _getTelemetria() {
  // localStorage usage
  let lsBytes = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      lsBytes += (localStorage.getItem(k) || '').length * 2;
    }
  } catch (e) { console.warn('AREX control: localStorage enumeration failed', e); }
  const lsKB = (lsBytes / 1024).toFixed(1);
  const lsMax = 5120; // 5MB estimate
  const lsPct = Math.min(100, Math.round(lsBytes / (lsMax * 10.24)));

  // SW version
  const swVer = window.AREX_SW_VERSION || 'v52';

  // Uptime
  const uptimeSec = Math.floor((Date.now() - _ctrlBootTime) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  const uptime = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  // Firebase
  const fbStatus = window._arexDb ? 'CONECTADO' : 'OFFLINE';

  // Groq key present
  const groqOk = !!(window.AREX_CONFIG?.groqKey);
  const geminiOk = !!(window.AREX_CONFIG?.geminiKey);

  return { lsKB, lsPct, swVer, uptime, fbStatus, groqOk, geminiOk };
}

function _renderTelemetria(el) {
  const t   = _getTelemetria();
  const log = _getBitacora();
  const recent = log.slice(0, 10);
  const _fmt = ms => new Date(ms).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const swVer = window.AREX_SW_VERSION || t.swVer;

  el.innerHTML = `
    <div class="diag-title">
      <span class="diag-title-line"></span>
      <span class="diag-title-text">▸ MISSION DIAGNOSTICS</span>
      <span class="diag-title-line"></span>
    </div>
    <div class="diag-grid">

      <!-- Q1: AI CORE INTEGRATION -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◈</span> AI CORE</div>
        <div class="diag-quad-body">
          <div class="diag-row">
            <span class="diag-k">GROQ LLAMA-4</span>
            <span class="diag-v ${t.groqOk?'ok':'err'}">${t.groqOk?'⬤ ONLINE':'⬤ SIN KEY'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">GEMINI 2.5</span>
            <span class="diag-v ${t.geminiOk?'ok':'muted'}">${t.geminiOk?'⬤ ACTIVO':'⬤ STANDBY'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">VISION MAVERICK</span>
            <span class="diag-v ${t.groqOk?'ok':'muted'}">${t.groqOk?'⬤ LISTO':'⬤ SIN KEY'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">TAVILY SEARCH</span>
            <span class="diag-v muted">⬤ CONFIGURADO</span>
          </div>
        </div>
      </div>

      <!-- Q2: NETWORK & SYNC -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◉</span> NETWORK & SYNC</div>
        <div class="diag-quad-body">
          <div class="diag-row">
            <span class="diag-k">FIREBASE DB</span>
            <span class="diag-v ${t.fbStatus==='CONECTADO'?'ok':'warn'}">${t.fbStatus==='CONECTADO'?'⬤ ENLAZADO':'⬤ OFFLINE'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">SERVICE WORKER</span>
            <span class="diag-v ok">${swVer} ⬤ ACTIVO</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">PWA MODE</span>
            <span class="diag-v ok">⬤ INSTALADO</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">SINCRONIZACIÓN</span>
            <span class="diag-v muted">⬤ TIEMPO REAL</span>
          </div>
        </div>
      </div>

      <!-- Q3: SYSTEM STATE -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◫</span> SYSTEM STATE</div>
        <div class="diag-quad-body">
          <div class="diag-row">
            <span class="diag-k">UPTIME SESIÓN</span>
            <span class="diag-v ok">${t.uptime}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">ALMACENAMIENTO</span>
            <span class="diag-v ${t.lsPct>70?'warn':'ok'}">${t.lsKB} KB <span class="diag-pct">(${t.lsPct}%)</span></span>
          </div>
          <div class="diag-storage-bar">
            <div class="diag-storage-fill" style="width:${t.lsPct}%"></div>
          </div>
          <div class="diag-row">
            <span class="diag-k">ENTRADAS DE LOG</span>
            <span class="diag-v muted">${log.length} registros</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">SESIÓN ACTUAL</span>
            <span class="diag-v ok">⬤ ACTIVA</span>
          </div>
        </div>
      </div>

      <!-- Q4: RECENT LOG -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◷</span> ACTIVIDAD RECIENTE</div>
        <div class="diag-quad-body diag-log">
          ${recent.length ? recent.map(e => `
            <div class="diag-log-row">
              <span class="diag-log-ts">${_fmt(e.ts)}</span>
              <span class="diag-log-mod ${e.modulo}">${e.modulo.slice(0,5).toUpperCase()}</span>
              <span class="diag-log-txt">${_h(String(e.accion)).slice(0,26)}</span>
            </div>`).join('') : '<div class="diag-empty">Sin actividad reciente</div>'}
        </div>
      </div>

    </div>`;
}

/* ── Log ─────────────────────────────────────────────── */
function _renderLog(el) {
  const all = _getBitacora();
  const filt = _logFilter === 'todos' ? all : all.filter(e => e.modulo === _logFilter);
  if (!filt.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:10px;padding:0.5rem;">Sin entradas en el log.</div>'; return; }
  const _fmt = ms => new Date(ms).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  el.innerHTML = filt.slice(0, 200).map(e =>
    `<div class="ctrl-log-entry">
      <span class="ctrl-log-ts">${_fmt(e.ts)}</span>
      <span class="ctrl-log-mod ${e.modulo}">${e.modulo.toUpperCase()}</span>
      <span class="ctrl-log-txt">${_h(String(e.accion))}</span>
    </div>`
  ).join('');
}

/* ── Agentes ─────────────────────────────────────────── */
const AGENT_ACTIVE_MS  = 300000;       // 5 min — ventana de actividad reciente
const AGENT_STALE_MS   = 30 * 60000;  // 30 min — re-run threshold when tab opens

function _autoRunStaleAgents() {
  const estado = JSON.parse(localStorage.getItem('arex_agentes_estado') || '{}');
  let delay = 0;
  for (const a of AGENTES) {
    const lastRun = estado[a.id]?.lastRun || 0;
    if (Date.now() - lastRun > AGENT_STALE_MS) {
      setTimeout(() => window._runAgent(a.id, a.area), delay);
      delay += 2500; // stagger to avoid API hammering
    }
  }
}

const AGENTES = [
  {
    id: 'hermes', nombre: 'HERMES', color: '#34ffc3',
    desc: 'Finanzas · Monitorea deudas y alertas de pago',
    area: 'finanzas'
  },
  {
    id: 'atlas', nombre: 'ATLAS', color: '#ff9900',
    desc: 'Negocio · Rastrea ventas y stock de frijol mayocoba',
    area: 'negocio'
  },
  {
    id: 'sentinel', nombre: 'SENTINEL', color: '#8B5CF6',
    desc: 'Sistema · Firebase y Service Worker',
    area: 'sistema'
  },
  {
    id: 'scribe', nombre: 'SCRIBE', color: '#22d3ee',
    desc: 'Notas · Organiza y resume información',
    area: 'chat'
  },
];

function _getAgentLastAction(area) {
  const log = _getBitacora();
  const last = log.find(e => e.modulo === area);
  if (!last) return 'Sin actividad registrada';
  const ago = Math.floor((Date.now() - last.ts) / 60000);
  return `Hace ${ago < 1 ? 'menos de 1 min' : ago + ' min'}: ${last.accion}`;
}

function _getAgentStatus(area) {
  const log = _getBitacora();
  const last = log.find(e => e.modulo === area);
  if (!last) return 'standby';
  return (Date.now() - last.ts) < AGENT_ACTIVE_MS ? 'online' : 'standby';
}

function _renderAgentes(el) {
  el.innerHTML = AGENTES.map(a => {
    const status  = _getAgentStatus(a.area);
    const last    = _getAgentLastAction(a.area);
    const orbState = status === 'online' ? 'active' : 'idle';
    return `
      <div class="agent-orb-wrap" data-agent="${a.id}" data-area="${a.area}"
           onclick="window._runAgent('${a.id}','${a.area}')">
        <canvas class="neural-orb-canvas"
                data-neural-orb="${a.id}"
                data-color="${a.color}"
                data-state="${orbState}"
                width="180" height="180"></canvas>
        <div class="agent-orb-name" style="color:${a.color};text-shadow:0 0 12px ${a.color}88">${a.nombre}</div>
        <div class="agent-orb-desc">${a.desc}</div>
        <div class="agent-orb-status ${status}">
          ${status === 'online' ? '● ACTIVO' : '○ EN ESPERA'}
        </div>
        <div class="agent-orb-last">${last}</div>
        <button class="agent-run-btn" style="border-color:${a.color}88;color:${a.color}">EJECUTAR</button>
      </div>`;
  }).join('');

  // Init canvas orbs after DOM is painted
  setTimeout(() => window.initNeuralOrbs?.(), 60);
}

window._runAgent = async function (agentId, area) {
  /* ── Safe JSON helper ─────────────────────────────────── */
  const _safeCtrlJSON = (s, fb) => { try { return JSON.parse(s || 'null') ?? fb; } catch { return fb; } };

  /* 1. Show thinking state */
  window.setNeuralOrbState?.(agentId, 'thinking');

  let cardTipo    = 'general';
  let cardTitulo  = agentId.toUpperCase();
  let cardContent = '';
  let shortSummary = '';
  let hasError    = false;

  try {
    /* ════════════════════════════════════════════════════════
       HERMES — Finanzas
    ═══════════════════════════════════════════════════════ */
    if (agentId === 'hermes') {
      const finData  = _safeCtrlJSON(localStorage.getItem('arex_finanzas'), {});
      const gpRaw    = _safeCtrlJSON(localStorage.getItem('arex_gastos_pers'), { gastos: [], presupuesto: {} });
      const gpData   = (gpRaw && Array.isArray(gpRaw.gastos)) ? gpRaw : { gastos: Array.isArray(gpRaw) ? gpRaw : [], presupuesto: {} };

      const ingreso  = finData.config?.ingresoMensual || 0;
      const deuda    = window.calcularDeudaTotal?.() || 0;
      const margen   = window.calcularMargen?.() || 0;

      // Gasto más alto de este mes
      const now         = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const gastosEsteMs = (gpData.gastos || []).filter(g => g.fecha && g.fecha >= firstOfMonth);
      let gastoMaxMonto  = 0;
      let gastoMaxConcepto = 'N/A';
      for (const g of gastosEsteMs) {
        if ((g.monto || 0) > gastoMaxMonto) {
          gastoMaxMonto    = g.monto || 0;
          gastoMaxConcepto = g.descripcion || g.categoria || 'Sin nombre';
        }
      }

      // Próximo pago <7 días
      const proxPagos = window.obtenerProximosPagos?.(7) || [];
      const proxStr   = proxPagos.length
        ? proxPagos.map(p => `${p.tarjeta||'Pago'} ($${(p.pagoMinimo||0).toFixed(0)})`).join(', ')
        : 'Ninguno en los próximos 7 días';

      // % deuda vs ingreso
      const deudaPct = (deuda / Math.max(1, ingreso) * 100).toFixed(1);

      cardTipo    = margen < 500 ? 'alerta' : 'finanzas';
      cardTitulo  = 'HERMES · Reporte Financiero';
      cardContent = `**Margen disponible:** $${margen.toFixed(0)}\n**Deuda vs ingreso:** ${deudaPct}%\n**Gasto más alto (mes):** ${gastoMaxConcepto} ($${gastoMaxMonto.toFixed(0)})\n**Próximo pago:** ${proxStr}${margen < 500 ? '\n\n⚠ ALERTA: Margen por debajo de $500' : ''}`;
      shortSummary = `Margen $${margen.toFixed(0)} · Deuda ${deudaPct}% ingreso`;

      logBitacora('finanzas', `HERMES: margen $${margen.toFixed(0)}, deuda ${deudaPct}%`);
    }

    /* ════════════════════════════════════════════════════════
       ATLAS — Negocio
    ═══════════════════════════════════════════════════════ */
    else if (agentId === 'atlas') {
      const negocio = _safeCtrlJSON(localStorage.getItem('arex_negocio'), {});

      // inventario is { stockKg: number, historial: [] } — not an array
      const inventario  = negocio.inventario || {};
      const stockKg     = Number(inventario.stockKg) || 0;
      const hayStockBajo = stockKg < (negocio.config?.stockMinimo ?? 5);

      // Calculate ganancia and ventas from real arrays (not stored as flat props)
      const now  = new Date();
      const imTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const ventas  = negocio.ventas  || [];
      const gastos  = negocio.gastos  || [];
      const vMes    = ventas.filter(v => v.fecha >= imTs).reduce((a, v) => a + (v.total || 0), 0);
      const gMes    = gastos.filter(g => g.fecha >= imTs).reduce((a, g) => a + (g.monto || 0), 0);
      const ganancia = vMes - gMes;
      const ventasHoy = ventas.filter(v => v.fecha >= todayTs && v.fecha < todayTs + 86400000)
                               .reduce((a, v) => a + (v.total || 0), 0);

      cardTipo    = hayStockBajo ? 'alerta' : 'negocio';
      cardTitulo  = 'ATLAS · Reporte de Negocio';
      cardContent = `**Ganancias del mes:** $${ganancia.toFixed(0)}\n**Ventas hoy:** $${ventasHoy.toFixed(0)}\n**Stock actual:** ${stockKg.toFixed(1)} kg${hayStockBajo ? '\n\n⚠ ALERTA: Stock por debajo de ' + (negocio.config?.stockMinimo ?? 5) + ' kg' : ''}`;
      shortSummary = `Ganancias $${ganancia.toFixed(0)} · Stock ${stockKg.toFixed(1)} kg`;

      logBitacora('negocio', `ATLAS: ganancias $${ganancia.toFixed(0)}, stock ${stockKg.toFixed(1)} kg${hayStockBajo ? ' ⚠ BAJO' : ''}`);
    }

    /* ════════════════════════════════════════════════════════
       SENTINEL — Sistema
    ═══════════════════════════════════════════════════════ */
    else if (agentId === 'sentinel') {
      // localStorage usage
      let lsBytes = 0;
      try {
        for (const k of Object.keys(localStorage)) {
          lsBytes += (localStorage.getItem(k) || '').length * 2;
        }
      } catch {}
      const lsKB = (lsBytes / 1024).toFixed(1);

      // Orphan keys — arex_ keys not in BACKUP_KEYS
      const orphans = [];
      try {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('arex_') && !BACKUP_KEYS.includes(k)) orphans.push(k);
        }
      } catch {}

      const swVer  = window.AREX_SW_VERSION || 'desconocida';
      const groqOk = !!(window.AREX_CONFIG?.groqKey);
      const fbOk   = !!(window._arexDb);

      cardTipo    = orphans.length ? 'alerta' : 'general';
      cardTitulo  = 'SENTINEL · Diagnóstico del Sistema';
      cardContent = `**Almacenamiento:** ${lsKB} KB\n**Service Worker:** ${swVer}\n**Groq API key:** ${groqOk ? 'Presente' : 'No configurada'}\n**Firebase:** ${fbOk ? 'Conectado' : 'Offline'}${orphans.length ? `\n\n⚠ Claves huérfanas (${orphans.length}): ${orphans.join(', ')}` : ''}`;
      shortSummary = `${lsKB} KB · SW ${swVer} · FB ${fbOk ? 'OK' : 'OFF'}`;

      logBitacora('sistema', `SENTINEL: ${lsKB} KB, FB ${fbOk ? 'OK' : 'OFFLINE'}, ${orphans.length} huérfanas`);
    }

    /* ════════════════════════════════════════════════════════
       SCRIBE — Notas
    ═══════════════════════════════════════════════════════ */
    else if (agentId === 'scribe') {
      const notas  = _safeCtrlJSON(localStorage.getItem('arex_notas'), []);
      const tareas = _safeCtrlJSON(localStorage.getItem('arex_tareas'), []);
      const notasArr  = Array.isArray(notas)  ? notas  : [];
      const tareasArr = Array.isArray(tareas) ? tareas : [];

      const todayStr     = new Date().toISOString().slice(0, 10);
      const notasSinTitulo = notasArr.filter(n => !n.titulo).length;
      const tareasVencidas = tareasArr.filter(t => !t.done && t.fecha && t.fecha < todayStr).length;

      let aiSummary = null;
      const groqKey = window.AREX_CONFIG?.groqKey;
      if (groqKey) {
        try {
          const recientes = notasArr.slice(-3).map(n => {
            const txt = (n.titulo || n.contenido || n.texto || '').slice(0, 60);
            return txt;
          }).filter(Boolean);
          if (recientes.length) {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`,
              },
              body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                max_tokens: 120,
                messages: [
                  {
                    role: 'user',
                    content: `Resume en 1-2 oraciones las siguientes notas recientes del usuario:\n${recientes.map((t,i) => `${i+1}. ${t}`).join('\n')}`,
                  },
                ],
              }),
            });
            if (resp.ok) {
              const json = await resp.json();
              aiSummary = json.choices?.[0]?.message?.content?.trim() || null;
            }
          }
        } catch {
          // fall back to local summary below
        }
      }

      const localSummary = notasArr.length
        ? `Últimas notas: ${notasArr.slice(-3).map(n => (n.titulo || n.contenido || 'Sin título').slice(0, 40)).join(' · ')}`
        : 'Sin notas registradas';

      const summaryLine = aiSummary ? `**Resumen IA:** ${aiSummary}` : `**Resumen local:** ${localSummary}`;

      cardTipo    = 'investigacion';
      cardTitulo  = 'SCRIBE · Análisis de Conocimiento';
      cardContent = `**Total notas:** ${notasArr.length}\n**Total tareas:** ${tareasArr.length}\n**Notas sin título:** ${notasSinTitulo}\n**Tareas vencidas:** ${tareasVencidas}\n${summaryLine}`;
      shortSummary = `${notasArr.length} notas · ${tareasVencidas} tareas vencidas`;

      logBitacora('chat', `SCRIBE: ${notasArr.length} notas, ${tareasVencidas} vencidas`);
    }

    /* 3. Add evidencia card */
    if (cardContent && typeof window.addEvidencia === 'function') {
      window.addEvidencia(cardTipo, cardTitulo, cardContent);
    }

    /* 4. Save agent state */
    try {
      const estado = _safeCtrlJSON(localStorage.getItem('arex_agentes_estado'), {});
      estado[agentId] = { lastRun: Date.now(), status: 'ok', summary: shortSummary };
      localStorage.setItem('arex_agentes_estado', JSON.stringify(estado));
      window.arexSyncData?.('arex_agentes_estado');
    } catch {}

    /* 5. Set orb to active */
    window.setNeuralOrbState?.(agentId, 'active');

  } catch (err) {
    hasError = true;
    console.error(`AREX _runAgent [${agentId}] error:`, err);
    logBitacora(area, `ERROR en agente ${agentId.toUpperCase()}: ${err.message || err}`);

    try {
      const estado = _safeCtrlJSON(localStorage.getItem('arex_agentes_estado'), {});
      estado[agentId] = { lastRun: Date.now(), status: 'error', summary: String(err.message || err).slice(0, 80) };
      localStorage.setItem('arex_agentes_estado', JSON.stringify(estado));
      window.arexSyncData?.('arex_agentes_estado');
    } catch {}

    window.setNeuralOrbState?.(agentId, 'idle');
  }

  /* 6. Refresh UI */
  window.renderEvidenciasWidget?.();
  window.renderDashboard?.();
  renderControlModule();
};

/* ── Export / Import / Backup ────────────────────────── */
const BACKUP_KEYS = [
  'arex_negocio','arex_gastos_pers','arex_metas','arex_tareas',
  'arex_recordatorios','arex_memoria','arex_hechos','arex_context',
  'arex_atajos','arex_proyectos','arex_evidencias','arex_notas',
  'arex_finanzas','arex_finanzas_overrides','arex_reparto_routes',
  'arex_personas','arex_gesture_map','arex_bitacora','arex_agentes_estado',
];

function _exportBackupJSON() {
  const backup = { _exportedAt: new Date().toISOString(), _version: window.AREX_SW_VERSION || 'arex' };
  for (const k of BACKUP_KEYS) {
    try { const v = localStorage.getItem(k); if (v) backup[k] = JSON.parse(v); } catch {}
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `arex-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  logBitacora('sistema', 'Backup JSON exportado');
}

function _exportGastosCSV() {
  try {
    const raw   = JSON.parse(localStorage.getItem('arex_gastos_pers') || '{}');
    const gs    = Array.isArray(raw) ? raw : (Array.isArray(raw.gastos) ? raw.gastos : []);
    if (!gs.length) { alert('Sin gastos para exportar.'); return; }
    const rows = [['Fecha','Descripción','Categoría','Monto']];
    for (const g of gs) rows.push([g.fecha||'',g.descripcion||'',g.categoria||'',(g.monto||0).toFixed(2)]);
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `arex-gastos-${new Date().toISOString().slice(0,7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logBitacora('sistema', `CSV gastos exportado (${gs.length} registros)`);
  } catch(e) { alert('Error exportando gastos: ' + e.message); }
}

function _exportTareasCSV() {
  try {
    const ts = JSON.parse(localStorage.getItem('arex_tareas') || '[]');
    if (!ts.length) { alert('Sin tareas para exportar.'); return; }
    const rows = [['Texto','Prioridad','Fecha','Estado']];
    for (const t of ts) rows.push([t.texto||t.text||'',t.prioridad||'media',t.fecha||'',t.done?'Completada':'Pendiente']);
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `arex-tareas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logBitacora('sistema', `CSV tareas exportado (${ts.length} registros)`);
  } catch(e) { alert('Error exportando tareas: ' + e.message); }
}

function _importBackupJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let imported = 0;
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith('arex_')) continue;
        localStorage.setItem(k, JSON.stringify(v));
        if (typeof arexSyncData === 'function') arexSyncData(k);
        imported++;
      }
      logBitacora('sistema', `Backup importado: ${imported} módulos restaurados`);
      // Re-render all modules
      window.renderTareas?.();
      window.renderMetas?.();
      window.renderProyectosModule?.();
      window.renderGpResumen?.();
      if (typeof renderNegocioModule === 'function') renderNegocioModule();
      renderControlModule();
      const msg = `✓ ${imported} módulos restaurados desde backup (${data._exportedAt?.slice(0,10) || 'sin fecha'}).`;
      alert(msg);
    } catch(e) { alert('Error leyendo backup: ' + e.message); }
  };
  reader.readAsText(file);
}

function _getStorageByModule() {
  const rows = [];
  for (const k of BACKUP_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (!v) continue;
      const kb = (v.length * 2 / 1024).toFixed(1);
      rows.push({ key: k.replace('arex_',''), kb: parseFloat(kb) });
    } catch {}
  }
  return rows.sort((a,b) => b.kb - a.kb);
}

function _renderDatos(el) {
  const rows  = _getStorageByModule();
  const total = rows.reduce((s,r) => s+r.kb, 0);
  const max   = 5120;
  const pct   = Math.min(100, Math.round((total / max) * 100));
  const fbOk  = !!(window._arexDb);
  const lastSync = window._arexLastSync ? new Date(window._arexLastSync).toLocaleTimeString('es-MX') : 'Nunca';

  el.innerHTML = `
    <!-- Sync status -->
    <div class="datos-section">
      <div class="datos-sec-lbl">◉ SINCRONIZACIÓN FIREBASE</div>
      <div class="datos-row">
        <span class="datos-k">Estado</span>
        <span class="datos-v ${fbOk?'ok':'warn'}">${fbOk?'⬤ CONECTADO':'⬤ SIN FIREBASE'}</span>
      </div>
      <div class="datos-row">
        <span class="datos-k">Última sync</span>
        <span class="datos-v">${lastSync}</span>
      </div>
      ${fbOk ? `<button class="datos-btn" onclick="window._forceSyncAll?.()">↑ SINCRONIZAR AHORA</button>` : ''}
    </div>

    <!-- Storage usage -->
    <div class="datos-section">
      <div class="datos-sec-lbl">◫ ALMACENAMIENTO LOCAL</div>
      <div class="datos-row">
        <span class="datos-k">Usado</span>
        <span class="datos-v ${pct>70?'warn':'ok'}">${total.toFixed(1)} KB <span style="opacity:.5;font-size:9px">(${pct}%)</span></span>
      </div>
      <div class="datos-bar-track"><div class="datos-bar-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-top:6px">
        ${rows.map(r => `
          <div class="datos-row" style="padding:2px 0">
            <span class="datos-k" style="font-size:8px">${r.key}</span>
            <span class="datos-v" style="font-size:8px">${r.kb} KB</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- Export -->
    <div class="datos-section">
      <div class="datos-sec-lbl">↓ EXPORTAR</div>
      <button class="datos-btn accent" onclick="window._exportBackupJSON?.()">⬇ BACKUP COMPLETO (.json)</button>
      <button class="datos-btn" onclick="window._exportGastosCSV?.()">⬇ GASTOS (.csv)</button>
      <button class="datos-btn" onclick="window._exportTareasCSV?.()">⬇ TAREAS (.csv)</button>
    </div>

    <!-- Import -->
    <div class="datos-section">
      <div class="datos-sec-lbl">↑ IMPORTAR / RESTAURAR</div>
      <div class="datos-warn">⚠ Restaurar un backup sobreescribe los datos actuales.</div>
      <label class="datos-btn" style="cursor:pointer;text-align:center">
        ⬆ RESTAURAR BACKUP (.json)
        <input type="file" accept=".json" style="display:none" onchange="window._importBackupJSON?.(this.files[0])"/>
      </label>
    </div>`;
}

window._exportBackupJSON  = _exportBackupJSON;
window._exportGastosCSV   = _exportGastosCSV;
window._exportTareasCSV   = _exportTareasCSV;
window._importBackupJSON  = _importBackupJSON;
window._forceSyncAll      = async function() {
  for (const k of BACKUP_KEYS) {
    if (localStorage.getItem(k) && typeof arexSyncData === 'function') await arexSyncData(k);
  }
  logBitacora('sistema', 'Sync manual completado');
  renderControlModule();
};

/* ── Render principal del módulo ────────────────────── */
function renderControlModule() {
  const wrap = document.getElementById('ctrl-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="ctrl-header">
      <div class="ctrl-title">MISSION CONTROL</div>
    </div>
    <div class="ctrl-tabs">
      <button class="ctrl-tab ${_ctrlView==='telemetria'?'active':''}" onclick="switchCtrlView('telemetria')">TELEMETRÍA</button>
      <button class="ctrl-tab ${_ctrlView==='bitacora'?'active':''}" onclick="switchCtrlView('bitacora')">BITÁCORA</button>
      <button class="ctrl-tab ${_ctrlView==='agentes'?'active':''}" onclick="switchCtrlView('agentes')">AGENTES</button>
      <button class="ctrl-tab ${_ctrlView==='datos'?'active':''}" onclick="switchCtrlView('datos')">DATOS</button>
    </div>

    <div class="ctrl-view ${_ctrlView==='telemetria'?'active':''}" id="ctrl-tel-view">
      <div id="ctrl-tel-body"></div>
    </div>

    <div class="ctrl-view ${_ctrlView==='bitacora'?'active':''}" id="ctrl-log-view">
      <div class="ctrl-log-filters">
        ${['todos','chat','finanzas','negocio','sistema','alerta'].map(f =>
          `<button class="ctrl-tab ${_logFilter===f?'active':''}" style="font-size:8px;padding:4px 10px" onclick="ctrlSetFilter('${f}')">${f.toUpperCase()}</button>`
        ).join('')}
      </div>
      <div class="ctrl-log-wrap">
        <div id="ctrl-log-body"></div>
      </div>
    </div>

    <div class="ctrl-view ${_ctrlView==='agentes'?'active':''}" id="ctrl-agents-view">
      <div style="display:flex;justify-content:flex-end;padding:4px 8px 0">
        <button class="ctrl-tab" onclick="AGENTES.forEach(a=>window._runAgent(a.id,a.area))" style="font-size:9px;padding:4px 14px;border-color:var(--cyan)44;color:var(--cyan)">▶ EJECUTAR TODOS</button>
      </div>
      <div class="ctrl-agents" id="ctrl-agents-body"></div>
    </div>

    <div class="ctrl-view ${_ctrlView==='datos'?'active':''}" id="ctrl-datos-view">
      <div id="ctrl-datos-body"></div>
    </div>`;

  if (_ctrlView === 'telemetria') {
    const tel = document.getElementById('ctrl-tel-body');
    if (tel) _renderTelemetria(tel);
    clearInterval(window._ctrlTelTimer);
    window._ctrlTelTimer = setInterval(() => {
      const t = document.getElementById('ctrl-tel-body');
      if (t && (document.getElementById('module-control')?.classList.contains('active') || document.getElementById('module-control')?.classList.contains('drawer-open'))) _renderTelemetria(t);
      else clearInterval(window._ctrlTelTimer);
    }, 5000);
  } else if (_ctrlView === 'bitacora') {
    const log = document.getElementById('ctrl-log-body');
    if (log) _renderLog(log);
  } else if (_ctrlView === 'agentes') {
    const ag = document.getElementById('ctrl-agents-body');
    if (ag) {
      if (typeof window.initNeuralOrbs !== 'function') {
        const _s = document.createElement('script');
        _s.src = './neural-orb.js';
        _s.onload  = () => { _renderAgentes(ag); _autoRunStaleAgents(); };
        _s.onerror = () => { _renderAgentes(ag); _autoRunStaleAgents(); };
        document.body.appendChild(_s);
      } else {
        _renderAgentes(ag);
        _autoRunStaleAgents();
      }
    }
  } else if (_ctrlView === 'datos') {
    const dt = document.getElementById('ctrl-datos-body');
    if (dt) _renderDatos(dt);
  }
}

function switchCtrlView(view) {
  _ctrlView = view;
  renderControlModule();
}

function ctrlSetFilter(f) {
  _logFilter = f;
  renderControlModule();
}

window.renderControlModule = renderControlModule;
window.switchCtrlView      = switchCtrlView;
window.ctrlSetFilter       = ctrlSetFilter;
window.logBitacora         = logBitacora;
