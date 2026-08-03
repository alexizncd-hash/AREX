// ══════════════════════════════════════════════════════
// AREX — Módulo Negocio (Frijol)
// Gestión de inventario, ventas, sucursales y gastos
// ══════════════════════════════════════════════════════
let _negChartPeriod = '7d';

const NEGOCIO_KEY = 'arex_negocio';

function getNegocioData() {
  const defaults = {
    config: {
      variedad:     'Frijol Pinto',
      precioVenta:  12,   // precio por medio litro
      costoKg:      30,   // precio de compra por kg
      rendimiento:  1.8,  // medio litros por kg
      costoEmpaque: 0.5,  // costo del vaso/envase
      metaMensual:  0,    // meta de ventas por mes
      stockMinimo:  5,    // kg mínimos antes de alerta
    },
    inventario: { stockKg: 0, historial: [] },
    sucursales: [],
    ventas:     [],
    gastos:     [],
    entregas:   []   // consignación: producto dejado en cada tienda
  };
  try {
    const raw = localStorage.getItem(NEGOCIO_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    return {
      config:     { ...defaults.config,     ...saved.config },
      inventario: { ...defaults.inventario, ...saved.inventario },
      sucursales: saved.sucursales || [],
      ventas:     saved.ventas     || [],
      gastos:     saved.gastos     || [],
      entregas:   saved.entregas   || []
    };
  } catch { return defaults; }
}

function saveNegocioData(data) {
  localStorage.setItem(NEGOCIO_KEY, JSON.stringify(data));
  if (typeof arexSyncData === 'function') arexSyncData(NEGOCIO_KEY);
}

// ── Consignación: estado por tienda ─────────────────
// existencia = ML entregados − ML vendidos desde la primera entrega
function negTiendaStats(sucId, data) {
  const d   = data || getNegocioData();
  const suc = d.sucursales.find(s => s.id === sucId);
  const ent = (d.entregas || []).filter(e => e.sucursalId === sucId);
  const im  = inicioMes();
  const vMes = d.ventas.filter(v => v.sucursalId === sucId && v.fecha >= im);
  const stats = {
    modo:       suc?.modo === 'consignacion' ? 'consignacion' : 'contado',
    vendidoMes: vMes.reduce((a, v) => a + v.total, 0),
    mlMes:      vMes.reduce((a, v) => a + v.cantidad, 0),
    existencia: 0,
    ultimaEntrega: null,
    resurtir:   false,
  };
  if (ent.length) {
    const primera   = Math.min(...ent.map(e => e.fecha));
    const entregado = ent.reduce((a, e) => a + e.cantidadML, 0);
    const vendido   = d.ventas.filter(v => v.sucursalId === sucId && v.fecha >= primera)
                              .reduce((a, v) => a + v.cantidad, 0);
    stats.existencia    = Math.max(0, entregado - vendido);
    stats.ultimaEntrega = ent.reduce((m, e) => e.fecha > m.fecha ? e : m, ent[0]);
    stats.resurtir      = stats.modo === 'consignacion' && stats.existencia < (suc?.minML ?? 10);
  } else {
    stats.resurtir = stats.modo === 'consignacion';
  }
  return stats;
}

function negRegistrarEntrega(sucId, cantidadML, fechaTs) {
  const data = getNegocioData();
  const suc  = data.sucursales.find(s => s.id === sucId);
  if (!suc) { alert('Sucursal no encontrada'); return false; }
  const cant = parseInt(cantidadML);
  if (!cant || cant < 1) { alert('Ingresa una cantidad válida de ML'); return false; }
  const fecha = fechaTs || Date.now();
  data.entregas.push({ id: String(Date.now()), fecha, sucursalId: sucId, cantidadML: cant });
  // El producto sale del inventario central: ahora está en la tienda
  const kg = cant / data.config.rendimiento;
  data.inventario.stockKg = Math.max(0, data.inventario.stockKg - kg);
  data.inventario.historial.push({ id: String(Date.now() + 1), fecha, tipo: 'salida', kg, nota: `Entrega ${cant} ML → ${suc.nombre}` });
  saveNegocioData(data);
  window.logBitacora?.('negocio', `Entrega: ${cant} ML → ${suc.nombre}`);
  return true;
}

function negEliminarEntrega(id) {
  if (!confirm('¿Eliminar esta entrega? El producto regresa a tu inventario central.')) return;
  const data = getNegocioData();
  const e = data.entregas.find(x => x.id === id);
  if (!e) return;
  data.entregas = data.entregas.filter(x => x.id !== id);
  const kg = e.cantidadML / data.config.rendimiento;
  data.inventario.stockKg += kg;
  data.inventario.historial.push({ id: String(Date.now()), fecha: Date.now(), tipo: 'entrada', kg, nota: `Entrega eliminada (${e.cantidadML} ML devueltos)` });
  saveNegocioData(data);
  renderNegSucursales();
}

// Registrar entrega desde la tarjeta de sucursal (lee el input de la card)
function negEntregaUI(sucId) {
  const inp = document.getElementById(`neg-ent-${sucId}`);
  if (negRegistrarEntrega(sucId, inp?.value)) renderNegSucursales();
}

// ── Formatters ──────────────────────────────────────
const $MXN  = n => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const $KG   = n => `${Number(n).toFixed(1)} kg`;
const $DATE = d => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const todayISO = () => new Date().toISOString().slice(0, 10);
const inicioMes = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
const escAttr = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Navegación de vistas ────────────────────────────
function switchNegocioView(view) {
  document.querySelectorAll('#module-negocio .neg-view').forEach(v =>
    v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('#module-negocio .neg-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  const renders = {
    dashboard:  renderNegDashboard,
    ventas:     renderNegVentas,
    inventario: renderNegInventario,
    sucursales: renderNegSucursales,
    gastos:     renderNegGastos,
    config:     renderNegConfig
  };
  renders[view]?.();
}

// ── Dashboard ───────────────────────────────────────
function _mesAnterior() {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const e = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return { s, e };
}

function _diffPct(curr, prev) {
  if (prev === 0) return curr > 0 ? '100' : null;
  return ((curr - prev) / prev * 100).toFixed(0);
}

function _trend(curr, prev) {
  if (prev == null || curr == null) return '';
  const pct = _diffPct(curr, prev);
  if (pct === null) return '';
  const up = Number(pct) >= 0;
  return `<span class="neg-kpi-trend ${up ? 'neg-profit' : 'neg-loss'}">${up ? '↑' : '↓'}${Math.abs(pct)}%</span>`;
}

function renderNegDashboard() {
  const data = getNegocioData();
  const im   = inicioMes();
  const { s: imAnt, e: imAntFin } = _mesAnterior();
  const ventasMes  = data.ventas.filter(v => v.fecha >= im);
  const gastosMes  = data.gastos.filter(g => g.fecha >= im);
  const ventasAnt  = data.ventas.filter(v => v.fecha >= imAnt && v.fecha < imAntFin);
  const gastosAnt  = data.gastos.filter(g => g.fecha >= imAnt && g.fecha < imAntFin);
  const totalVentas = ventasMes.reduce((a, v) => a + v.total, 0);
  const totalGastos = gastosMes.reduce((a, g) => a + g.monto, 0);
  const ganancia    = totalVentas - totalGastos;
  const totalVentasAnt = ventasAnt.reduce((a, v) => a + v.total, 0);
  const totalGastosAnt = gastosAnt.reduce((a, g) => a + g.monto, 0);
  const gananciaAnt    = totalVentasAnt - totalGastosAnt;
  const mlVendidos  = ventasMes.reduce((a, v) => a + v.cantidad, 0);
  const mlDisp      = Math.floor(data.inventario.stockKg * data.config.rendimiento);
  const margen      = totalVentas > 0 ? ((ganancia / totalVentas) * 100).toFixed(1) : '—';

  const porSuc = {};
  ventasMes.forEach(v => {
    const s = data.sucursales.find(s => s.id === v.sucursalId);
    const n = s ? s.nombre : 'Sin sucursal';
    porSuc[n] = (porSuc[n] || 0) + v.total;
  });
  const top = Object.entries(porSuc).sort((a, b) => b[1] - a[1])[0];

  const recientes = [
    ...data.ventas.slice(-5).map(v => ({
      fecha: v.fecha, tipo: 'venta',
      desc: data.sucursales.find(s => s.id === v.sucursalId)?.nombre || 'Sin sucursal',
      monto: v.total
    })),
    ...data.gastos.slice(-3).map(g => ({ fecha: g.fecha, tipo: 'gasto', desc: g.concepto, monto: g.monto }))
  ].sort((a, b) => b.fecha - a.fecha).slice(0, 6);

  // ── Gráfica ──
  const chartDays = [];
  if (_negChartPeriod === '7d') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end   = start + 86400000;
      const tot   = data.ventas.filter(v => v.fecha >= start && v.fecha < end).reduce((a, v) => a + v.total, 0);
      chartDays.push({ label: d.toLocaleDateString('es-MX', { weekday:'short' }).slice(0,3).toUpperCase(), total: tot });
    }
  } else {
    const now = new Date();
    const som = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil(dim / 7);
    for (let w = 0; w < weeks; w++) {
      const wS = som + w * 7 * 86400000;
      const wE = Math.min(wS + 7 * 86400000, som + dim * 86400000);
      const tot = data.ventas.filter(v => v.fecha >= wS && v.fecha < wE).reduce((a, v) => a + v.total, 0);
      chartDays.push({ label: `S${w + 1}`, total: tot });
    }
  }
  const chartMax = Math.max(...chartDays.map(d => d.total), 1);

  // ── Meta mensual ──
  const meta    = data.config.metaMensual || 0;
  const metaPct = meta > 0 ? Math.min(100, (totalVentas / meta) * 100).toFixed(0) : 0;

  const stockMin = data.config.stockMinimo || 5;
  const stockBajo = data.inventario.stockKg < stockMin;
  if (stockBajo && typeof logBitacora === 'function') {
    logBitacora('negocio', `⚠ Stock bajo: ${$KG(data.inventario.stockKg)} (mín: ${$KG(stockMin)})`);
  }

  document.getElementById('neg-dash-content').innerHTML = `
    ${stockBajo ? `<div class="neg-stock-alert" style="margin-bottom:0.5rem;padding:8px 10px;background:rgba(255,153,0,0.06);border:1px solid rgba(255,153,0,0.3);border-left:3px solid #ff9900;border-radius:4px;font-size:10px;letter-spacing:1px;">⚠ STOCK BAJO — ${$KG(data.inventario.stockKg)} disponibles (mínimo: ${$KG(stockMin)})</div>` : ''}
    <div class="neg-kpi-grid">
      <div class="neg-kpi neg-kpi-nav ${stockBajo ? 'neg-kpi-warn' : ''}" onclick="switchNegocioView('inventario')" title="Ver inventario">
        <div class="neg-kpi-lbl">STOCK <span class="neg-kpi-arrow">›</span></div>
        <div class="neg-kpi-val">${$KG(data.inventario.stockKg)}</div>
        <div class="neg-kpi-sub">≈ ${mlDisp} medio litros</div>
      </div>
      <div class="neg-kpi neg-kpi-nav" onclick="switchNegocioView('ventas')" title="Ver ventas">
        <div class="neg-kpi-lbl">VENTAS MES ${_trend(totalVentas, totalVentasAnt)} <span class="neg-kpi-arrow">›</span></div>
        <div class="neg-kpi-val">${$MXN(totalVentas)}</div>
        <div class="neg-kpi-sub">${mlVendidos} ML · ant: ${$MXN(totalVentasAnt)}</div>
      </div>
      <div class="neg-kpi neg-kpi-nav" onclick="switchNegocioView('gastos')" title="Ver gastos">
        <div class="neg-kpi-lbl">GANANCIA MES ${_trend(ganancia, gananciaAnt)} <span class="neg-kpi-arrow">›</span></div>
        <div class="neg-kpi-val ${ganancia >= 0 ? 'neg-profit' : 'neg-loss'}">${$MXN(ganancia)}</div>
        <div class="neg-kpi-sub">Margen: ${margen}% · ant: ${$MXN(gananciaAnt)}</div>
      </div>
      <div class="neg-kpi neg-kpi-nav" onclick="switchNegocioView('sucursales')" title="Ver sucursales">
        <div class="neg-kpi-lbl">SUCURSALES <span class="neg-kpi-arrow">›</span></div>
        <div class="neg-kpi-val">${data.sucursales.filter(s => s.activa).length}</div>
        <div class="neg-kpi-sub">${top ? 'Top: ' + top[0] : 'Sin ventas'}</div>
      </div>
    </div>

    ${meta > 0 ? `
    <div class="neg-meta-bar">
      <div class="neg-meta-label">
        <span>META MENSUAL</span>
        <span>${$MXN(totalVentas)} / ${$MXN(meta)} · ${metaPct}%</span>
      </div>
      <div class="neg-meta-track">
        <div class="neg-meta-fill ${parseInt(metaPct) >= 100 ? 'complete' : ''}" style="width:${metaPct}%"></div>
      </div>
    </div>` : ''}

    <div class="neg-chart">
      <div class="neg-chart-header">
        <span class="neg-chart-title">${_negChartPeriod === '7d' ? 'VENTAS ÚLTIMOS 7 DÍAS' : 'VENTAS ESTE MES'}</span>
        <div class="neg-chart-tabs">
          <button class="neg-chart-tab${_negChartPeriod === '7d' ? ' active' : ''}" onclick="negChartPeriod('7d')">7 DÍAS</button>
          <button class="neg-chart-tab${_negChartPeriod === 'mes' ? ' active' : ''}" onclick="negChartPeriod('mes')">MES</button>
        </div>
      </div>
      <div class="neg-chart-bars">
        ${chartDays.map(d => `
          <div class="neg-chart-col">
            <div class="neg-chart-bar-wrap">
              <div class="neg-chart-bar ${d.total > 0 ? 'has-val' : ''}" style="height:${Math.round((d.total/chartMax)*100)}%"></div>
            </div>
            <div class="neg-chart-lbl">${d.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="neg-form-row" style="gap:0.5rem">
      <button class="neg-btn-primary" style="flex:1" onclick="switchNegocioView('ventas')">+ REGISTRAR VENTA</button>
      <button class="neg-btn-primary" style="flex:0 0 auto;padding:9px 14px;letter-spacing:1px;font-size:9px" onclick="negExportarMes()" title="Exportar resumen del mes">⬇ RESUMEN</button>
    </div>

    <div class="neg-section-title">ACTIVIDAD RECIENTE</div>
    ${recientes.length === 0
      ? '<div class="neg-empty">Sin actividad registrada aún.</div>'
      : `<div class="neg-activity">
          ${recientes.map(r => `
            <div class="neg-act-item">
              <span class="neg-act-dot" style="background:${r.tipo === 'venta' ? '#34ffc3' : '#ff9900'}"></span>
              <span class="neg-act-desc">${$DATE(r.fecha)} · ${r.desc}</span>
              <span class="${r.tipo === 'venta' ? 'neg-profit' : 'neg-loss'}">${r.tipo === 'venta' ? '' : '-'}${$MXN(r.monto)}</span>
            </div>`).join('')}
        </div>`}
    <div id="neg-export-box" class="neg-export-box" style="display:none"></div>
  `;
}

// ── Exportar resumen mensual ─────────────────────────
function negExportarMes() {
  const data = getNegocioData();
  const im   = inicioMes();
  const { s: imAnt, e: imAntFin } = _mesAnterior();
  const now  = new Date();
  const mesNom = now.toLocaleDateString('es-MX', { month:'long', year:'numeric' }).toUpperCase();
  const ventasMes  = data.ventas.filter(v => v.fecha >= im);
  const gastosMes  = data.gastos.filter(g => g.fecha >= im);
  const ventasAnt  = data.ventas.filter(v => v.fecha >= imAnt && v.fecha < imAntFin);
  const gastosAnt  = data.gastos.filter(g => g.fecha >= imAnt && g.fecha < imAntFin);
  const totalVentas = ventasMes.reduce((a, v) => a + v.total, 0);
  const totalGastos = gastosMes.reduce((a, g) => a + g.monto, 0);
  const ganancia    = totalVentas - totalGastos;
  const totalVentasAnt = ventasAnt.reduce((a, v) => a + v.total, 0);
  const gananciaAnt    = totalVentasAnt - gastosAnt.reduce((a, g) => a + g.monto, 0);

  const pct = totalVentasAnt > 0 ? (((totalVentas - totalVentasAnt) / totalVentasAnt) * 100).toFixed(1) : 'N/A';

  const txt = [
    `RESUMEN MENSUAL — ${mesNom}`,
    `─────────────────────────────`,
    `VENTAS:         ${$MXN(totalVentas)} (ant: ${$MXN(totalVentasAnt)}, ${pct !== 'N/A' ? (Number(pct) >= 0 ? '+' : '') + pct + '%' : 'N/A'})`,
    `GASTOS:         ${$MXN(totalGastos)}`,
    `GANANCIA NETA:  ${$MXN(ganancia)}`,
    `TRANSACCIONES:  ${ventasMes.length} ventas · ${gastosMes.length} gastos`,
    `─────────────────────────────`,
    `Generado por AREX · ${new Date().toLocaleString('es-MX')}`
  ].join('\n');

  const box = document.getElementById('neg-export-box');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <pre class="neg-export-txt">${txt}</pre>
    <button class="neg-btn-primary" style="margin-top:6px;font-size:9px" onclick="navigator.clipboard?.writeText(${JSON.stringify(txt)}).then(()=>{this.textContent='✓ COPIADO';setTimeout(()=>this.textContent='COPIAR',1500)})">COPIAR</button>
  `;
}

// ── Ventas ──────────────────────────────────────────
function renderNegVentas() {
  const data = getNegocioData();

  document.getElementById('neg-ventas-content').innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">NUEVA VENTA</div>
      <div class="neg-form-row">
        <select id="neg-v-suc" class="neg-select">
          <option value="">Selecciona sucursal...</option>
          ${data.sucursales.filter(s => s.activa).map(s =>
            `<option value="${s.id}">${s.nombre}</option>`).join('')}
        </select>
        <input type="number" id="neg-v-cant" class="neg-input" placeholder="Medio litros" min="1" step="1"/>
      </div>
      <div class="neg-form-row">
        <input type="number" id="neg-v-precio" class="neg-input" placeholder="Precio/ML (por defecto: $${data.config.precioVenta})" step="0.5"/>
        <input type="date"   id="neg-v-fecha"  class="neg-input" value="${todayISO()}"/>
      </div>
      <div id="neg-v-preview" class="neg-total-preview"></div>
      <button class="neg-btn-primary" onclick="negRegistrarVenta()">REGISTRAR VENTA</button>
    </div>

    <div class="neg-section-title">HISTORIAL (${data.ventas.length} ventas)</div>
    ${data.ventas.length === 0
      ? '<div class="neg-empty">Sin ventas registradas.</div>'
      : `<div class="neg-list">
          ${data.ventas.slice().reverse().map(v => {
            const s = data.sucursales.find(s => s.id === v.sucursalId);
            return `<div class="neg-list-item" data-venta-id="${v.id}">
              <div class="neg-li-top">
                <span class="neg-li-name">${_h(s ? s.nombre : 'Sin sucursal')}</span>
                <span class="neg-profit">${$MXN(v.total)}</span>
              </div>
              <div class="neg-li-bot">
                <span>${$DATE(v.fecha)}</span>
                <span>${v.cantidad} ML × ${$MXN(v.precioUnitario)}</span>
                <button class="neg-edit" onclick="negEditarVenta('${v.id}')">editar</button>
                <button class="neg-del"  onclick="negEliminarVenta('${v.id}')">✕</button>
              </div>
            </div>`;
          }).join('')}
        </div>`}
  `;

  ['neg-v-cant','neg-v-precio'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', () => {
      const cant   = parseFloat(document.getElementById('neg-v-cant').value)   || 0;
      const precio = parseFloat(document.getElementById('neg-v-precio').value) || data.config.precioVenta;
      const total  = cant * precio;
      document.getElementById('neg-v-preview').textContent = total > 0 ? `Total: ${$MXN(total)}` : '';
    })
  );
}

function negRegistrarVenta() {
  const data      = getNegocioData();
  const sucId     = document.getElementById('neg-v-suc').value;
  const cantidad  = parseInt(document.getElementById('neg-v-cant').value);
  const precio    = parseFloat(document.getElementById('neg-v-precio').value) || data.config.precioVenta;
  const fechaStr  = document.getElementById('neg-v-fecha').value;

  if (!sucId)               { alert('Selecciona una sucursal');  return; }
  if (!cantidad || cantidad < 1) { alert('Ingresa la cantidad');  return; }

  const fecha = new Date(fechaStr + 'T12:00:00').getTime();
  const total = cantidad * precio;

  data.ventas.push({ id: String(Date.now()), fecha, sucursalId: sucId, cantidad, precioUnitario: precio, total });

  // Consignación: el stock salió del inventario central al registrar la ENTREGA,
  // la venta solo descuenta existencia de tienda (calculada). Contado: flujo normal.
  const sucVenta = data.sucursales.find(s => s.id === sucId);
  if (sucVenta?.modo !== 'consignacion') {
    const kgUsados = cantidad / data.config.rendimiento;
    data.inventario.stockKg = Math.max(0, data.inventario.stockKg - kgUsados);
    data.inventario.historial.push({ id: String(Date.now() + 1), fecha, tipo: 'salida', kg: kgUsados, nota: `Venta ${cantidad} ML` });
  }

  saveNegocioData(data);
  renderNegVentas();
}

function negEliminarVenta(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  const data = getNegocioData();
  data.ventas = data.ventas.filter(v => v.id !== id);
  saveNegocioData(data);
  renderNegVentas();
}

function negEditarVenta(id) {
  const data = getNegocioData();
  const v = data.ventas.find(v => v.id === id);
  if (!v) return;
  const el = document.querySelector(`[data-venta-id="${id}"]`);
  if (!el) return;
  const fechaStr = new Date(v.fecha).toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="neg-form-row">
      <select id="neg-ve-suc-${id}" class="neg-select">
        ${data.sucursales.map(s =>
          `<option value="${s.id}" ${s.id === v.sucursalId ? 'selected' : ''}>${escAttr(s.nombre)}</option>`
        ).join('')}
      </select>
      <input type="number" id="neg-ve-cant-${id}" class="neg-input" value="${v.cantidad}" placeholder="ML" min="1"/>
    </div>
    <div class="neg-form-row">
      <input type="number" id="neg-ve-precio-${id}" class="neg-input" value="${v.precioUnitario}" placeholder="Precio/ML" step="0.5"/>
      <input type="date"   id="neg-ve-fecha-${id}"  class="neg-input" value="${fechaStr}"/>
    </div>
    <div class="neg-form-row" style="margin-top:0.2rem">
      <button class="neg-btn-primary" onclick="negGuardarEditVenta('${id}')">GUARDAR</button>
      <button class="neg-btn-primary neg-btn-cancel" onclick="renderNegVentas()">CANCELAR</button>
    </div>`;
}

function negGuardarEditVenta(id) {
  const data     = getNegocioData();
  const v        = data.ventas.find(v => v.id === id);
  if (!v) return;
  const sucId    = document.getElementById(`neg-ve-suc-${id}`)?.value;
  const cantidad = parseInt(document.getElementById(`neg-ve-cant-${id}`)?.value);
  const precio   = parseFloat(document.getElementById(`neg-ve-precio-${id}`)?.value);
  const fechaStr = document.getElementById(`neg-ve-fecha-${id}`)?.value;
  if (!cantidad || cantidad < 1) { alert('Ingresa la cantidad'); return; }
  if (!precio   || precio   <= 0) { alert('Ingresa el precio'); return; }
  v.sucursalId    = sucId;
  v.cantidad      = cantidad;
  v.precioUnitario = precio;
  v.total         = cantidad * precio;
  v.fecha         = new Date(fechaStr + 'T12:00:00').getTime();
  saveNegocioData(data);
  renderNegVentas();
}

// ── Inventario ──────────────────────────────────────
function renderNegInventario() {
  const data    = getNegocioData();
  const mlDisp  = Math.floor(data.inventario.stockKg * data.config.rendimiento);
  const stockBajo = data.inventario.stockKg < 5;

  document.getElementById('neg-inv-content').innerHTML = `
    <div class="neg-stock-hero ${stockBajo ? 'neg-stock-low' : ''}">
      <div class="neg-stock-val">${$KG(data.inventario.stockKg)}</div>
      <div class="neg-stock-lbl">STOCK ACTUAL</div>
      <div class="neg-stock-sub">≈ ${mlDisp} medio litros disponibles</div>
      ${stockBajo ? '<div class="neg-stock-alert">⚠ Stock bajo — considera reabastecer</div>' : ''}
    </div>

    <div class="neg-form-card">
      <div class="neg-form-title">ENTRADA DE PRODUCTO</div>
      <div class="neg-form-row">
        <input type="number" id="neg-i-kg"    class="neg-input" placeholder="Kilogramos comprados" step="0.5" min="0.5"/>
        <input type="number" id="neg-i-costo" class="neg-input" placeholder="Costo total ($)" step="10"/>
      </div>
      <input type="date" id="neg-i-fecha" class="neg-input" value="${todayISO()}" style="width:100%"/>
      <button class="neg-btn-primary" onclick="negAgregarStock()">AGREGAR STOCK</button>
    </div>

    <div class="neg-form-card" style="border-color:rgba(255,153,0,0.2)">
      <div class="neg-form-title" style="color:#ff9900">CORRECCIÓN MANUAL DE STOCK</div>
      <input type="number" id="neg-i-ajuste" class="neg-input" placeholder="Stock correcto en kg (ej: 12.5)" step="0.1" min="0" style="width:100%"/>
      <button class="neg-btn-primary" style="border-color:#ff9900;color:#ff9900" onclick="negAjustarStock()">ESTABLECER STOCK</button>
    </div>

    <div class="neg-section-title">MOVIMIENTOS RECIENTES</div>
    ${data.inventario.historial.length === 0
      ? '<div class="neg-empty">Sin movimientos registrados.</div>'
      : `<div class="neg-list">
          ${data.inventario.historial.slice().reverse().slice(0, 25).map(h => `
            <div class="neg-list-item">
              <div class="neg-li-top">
                <span class="neg-li-name">${h.tipo === 'entrada' ? '↑ Entrada' : '↓ Salida'} — ${$KG(h.kg)}</span>
                <span class="${h.tipo === 'entrada' ? 'neg-profit' : 'neg-loss'}">${h.tipo === 'entrada' ? '+' : '-'}${$KG(h.kg)}</span>
              </div>
              <div class="neg-li-bot">
                <span>${$DATE(h.fecha)}</span>
                ${h.nota ? `<span>${_h(h.nota)}</span>` : ''}
                ${h.id ? `<button class="neg-del" onclick="negEliminarHistorial('${h.id}')">✕</button>` : ''}
              </div>
            </div>`).join('')}
        </div>`}
  `;
}

function negAgregarStock() {
  const data     = getNegocioData();
  const kg       = parseFloat(document.getElementById('neg-i-kg').value);
  const costo    = parseFloat(document.getElementById('neg-i-costo').value) || 0;
  const fechaStr = document.getElementById('neg-i-fecha').value;

  if (!kg || kg <= 0) { alert('Ingresa los kilogramos'); return; }

  const fecha = new Date(fechaStr + 'T12:00:00').getTime();
  data.inventario.stockKg += kg;
  data.inventario.historial.push({
    id: String(Date.now()), fecha, tipo: 'entrada', kg,
    nota: costo > 0 ? `Compra ${$MXN(costo)}` : ''
  });

  if (costo > 0) {
    data.gastos.push({
      id: String(Date.now()), fecha,
      concepto: `Compra ${$KG(kg)} de frijol`,
      monto: costo, tipo: 'materia_prima'
    });
  }

  saveNegocioData(data);
  renderNegInventario();
}

function negAjustarStock() {
  const kg = parseFloat(document.getElementById('neg-i-ajuste').value);
  if (isNaN(kg) || kg < 0) { alert('Ingresa el valor correcto de stock en kg'); return; }
  if (!confirm(`¿Establecer el stock en ${kg.toFixed(1)} kg? Esto reemplaza el valor actual.`)) return;
  const data = getNegocioData();
  const ant  = data.inventario.stockKg;
  data.inventario.stockKg = kg;
  data.inventario.historial.push({
    id: String(Date.now()), fecha: Date.now(), tipo: kg >= ant ? 'entrada' : 'salida',
    kg: Math.abs(kg - ant), nota: `Corrección manual (era ${$KG(ant)})`
  });
  saveNegocioData(data);
  renderNegInventario();
}

function negEliminarHistorial(id) {
  if (!confirm('¿Eliminar este movimiento del historial?')) return;
  const data = getNegocioData();
  data.inventario.historial = data.inventario.historial.filter(h => h.id !== id);
  saveNegocioData(data);
  renderNegInventario();
}

// ── Sucursales ──────────────────────────────────────
function renderNegSucursales() {
  const data = getNegocioData();
  const im   = inicioMes();

  document.getElementById('neg-suc-content').innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">NUEVO PUNTO DE VENTA</div>
      <input type="text" id="neg-s-nombre"   class="neg-input" placeholder="Nombre del abarrote / tienda" style="width:100%"/>
      <input type="text" id="neg-s-contacto" class="neg-input" placeholder="Contacto (opcional)" style="width:100%;margin-top:0.5rem"/>
      <select id="neg-s-modo" class="neg-select" style="width:100%;margin-top:0.5rem">
        <option value="contado">Contado — me pagan al entregar</option>
        <option value="consignacion">Consignación — dejo producto y cobro después</option>
      </select>
      <button class="neg-btn-primary" onclick="negAgregarSucursal()">AGREGAR</button>
    </div>

    <div class="neg-section-title">PUNTOS DE VENTA (${data.sucursales.length})</div>
    ${data.sucursales.length === 0
      ? '<div class="neg-empty">Sin puntos de venta registrados.<br>Agrega el primer abarrote donde vendes.</div>'
      : `<div class="neg-list">
          ${data.sucursales.map(s => {
            const st  = negTiendaStats(s.id, data);
            const consig = s.modo === 'consignacion';
            const ent3 = consig ? (data.entregas || []).filter(e => e.sucursalId === s.id).slice(-3).reverse() : [];
            return `<div class="neg-list-item ${!s.activa ? 'neg-inactive' : ''}" data-suc-id="${s.id}">
              <div class="neg-li-top">
                <span class="neg-li-name">${_h(s.nombre)}</span>
                <span class="neg-badge" style="${consig ? 'color:#34ffc3;border-color:rgba(52,255,195,0.35)' : ''}">${consig ? 'CONSIG' : 'CONTADO'}</span>
                <span class="neg-badge ${s.activa ? '' : 'neg-badge-off'}">${s.activa ? 'ACTIVA' : 'PAUSADA'}</span>
              </div>
              <div class="neg-li-bot">
                <span>${st.mlMes} ML · ${$MXN(st.vendidoMes)} este mes</span>
                ${s.contacto ? `<span>${_h(s.contacto)}</span>` : ''}
                <button class="neg-edit" onclick="negEditarSucursal('${s.id}')">editar</button>
                <button class="neg-del"  onclick="negToggleSucursal('${s.id}')" style="color:var(--text-muted)">${s.activa ? 'pausar' : 'activar'}</button>
                <button class="neg-del"  onclick="negEliminarSucursal('${s.id}')">✕</button>
              </div>
              ${consig ? `
              <div class="neg-consig">
                <div class="neg-consig-row">
                  <span>EN TIENDA: <b class="${st.resurtir ? 'neg-loss' : 'neg-profit'}">${st.existencia} ML</b>${st.resurtir ? ' <span class="neg-loss">⚠ RESURTIR</span>' : ''}</span>
                  <span>${st.ultimaEntrega ? `Últ. entrega: ${$DATE(st.ultimaEntrega.fecha)} (${st.ultimaEntrega.cantidadML} ML)` : 'Sin entregas aún'}</span>
                </div>
                <div class="neg-form-row" style="margin-top:4px">
                  <input type="number" id="neg-ent-${s.id}" class="neg-input" placeholder="ML a dejar" min="1" step="1"/>
                  <button class="neg-btn-primary" style="flex:0 0 auto;padding:8px 14px" onclick="negEntregaUI('${s.id}')">+ ENTREGA</button>
                </div>
                ${ent3.length ? `<div class="neg-consig-hist">${ent3.map(e =>
                  `<span class="neg-consig-chip">${$DATE(e.fecha)} · ${e.cantidadML} ML <button class="neg-del" onclick="negEliminarEntrega('${e.id}')">✕</button></span>`).join('')}</div>` : ''}
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>`}
  `;
}

function negAgregarSucursal() {
  const nombre = document.getElementById('neg-s-nombre').value.trim();
  if (!nombre) { alert('Ingresa el nombre'); return; }
  const data    = getNegocioData();
  const contacto = document.getElementById('neg-s-contacto').value.trim();
  const modo     = document.getElementById('neg-s-modo')?.value === 'consignacion' ? 'consignacion' : 'contado';
  data.sucursales.push({ id: String(Date.now()), nombre, contacto, activa: true, modo });
  saveNegocioData(data);
  renderNegSucursales();
}

function negToggleSucursal(id) {
  const data = getNegocioData();
  const s = data.sucursales.find(s => s.id === id);
  if (s) s.activa = !s.activa;
  saveNegocioData(data);
  renderNegSucursales();
}

function negEliminarSucursal(id) {
  if (!confirm('¿Eliminar este punto de venta?')) return;
  const data = getNegocioData();
  data.sucursales = data.sucursales.filter(s => s.id !== id);
  saveNegocioData(data);
  renderNegSucursales();
}

function negEditarSucursal(id) {
  const data = getNegocioData();
  const s = data.sucursales.find(s => s.id === id);
  if (!s) return;
  const el = document.querySelector(`[data-suc-id="${id}"]`);
  if (!el) return;
  el.innerHTML = `
    <input id="neg-se-nom-${id}"  class="neg-input" value="${escAttr(s.nombre)}"          placeholder="Nombre" style="margin-bottom:0.4rem"/>
    <input id="neg-se-con-${id}"  class="neg-input" value="${escAttr(s.contacto || '')}"  placeholder="Contacto (opcional)" style="margin-bottom:0.4rem"/>
    <div class="neg-form-row" style="margin-bottom:0.4rem">
      <select id="neg-se-modo-${id}" class="neg-select">
        <option value="contado"      ${s.modo !== 'consignacion' ? 'selected' : ''}>Contado</option>
        <option value="consignacion" ${s.modo === 'consignacion' ? 'selected' : ''}>Consignación</option>
      </select>
      <input type="number" id="neg-se-minml-${id}" class="neg-input" value="${s.minML ?? 10}" min="0" step="1" placeholder="Mín. ML antes de alerta" title="Alerta RESURTIR cuando la existencia baje de este valor"/>
    </div>
    <div class="neg-form-row">
      <button class="neg-btn-primary" onclick="negGuardarEditSucursal('${id}')">GUARDAR</button>
      <button class="neg-btn-primary neg-btn-cancel" onclick="renderNegSucursales()">CANCELAR</button>
    </div>`;
}

function negGuardarEditSucursal(id) {
  const nombre = document.getElementById(`neg-se-nom-${id}`)?.value.trim();
  if (!nombre) { alert('Ingresa el nombre'); return; }
  const data = getNegocioData();
  const s = data.sucursales.find(s => s.id === id);
  if (s) {
    s.nombre   = nombre;
    s.contacto = document.getElementById(`neg-se-con-${id}`)?.value.trim() || '';
    s.modo     = document.getElementById(`neg-se-modo-${id}`)?.value === 'consignacion' ? 'consignacion' : 'contado';
    const minML = parseInt(document.getElementById(`neg-se-minml-${id}`)?.value);
    if (!isNaN(minML) && minML >= 0) s.minML = minML;
    saveNegocioData(data);
  }
  renderNegSucursales();
}

// ── Gastos ──────────────────────────────────────────
function renderNegGastos() {
  const data      = getNegocioData();
  const im        = inicioMes();
  const gastosMes = data.gastos.filter(g => g.fecha >= im);
  const totalMes  = gastosMes.reduce((a, g) => a + g.monto, 0);
  const TIPOS     = { materia_prima: 'Materia prima', empaque: 'Empaque', transporte: 'Transporte', otro: 'Otro' };

  document.getElementById('neg-gast-content').innerHTML = `
    <div class="neg-resumen-gasto">
      <div class="neg-kpi-lbl">GASTOS DEL MES</div>
      <div class="neg-kpi-val neg-loss">${$MXN(totalMes)}</div>
    </div>

    <div class="neg-form-card">
      <div class="neg-form-title">REGISTRAR GASTO</div>
      <div class="neg-form-row">
        <select id="neg-g-tipo" class="neg-select">
          <option value="materia_prima">Materia prima</option>
          <option value="empaque">Empaque / envases</option>
          <option value="transporte">Transporte</option>
          <option value="otro">Otro</option>
        </select>
        <input type="number" id="neg-g-monto"   class="neg-input" placeholder="Monto ($)" step="1"/>
      </div>
      <div class="neg-form-row">
        <input type="text" id="neg-g-concepto" class="neg-input" placeholder="Descripción"/>
        <input type="date" id="neg-g-fecha"    class="neg-input" value="${todayISO()}"/>
      </div>
      <button class="neg-btn-primary" onclick="negRegistrarGasto()">REGISTRAR</button>
    </div>

    <div class="neg-section-title">HISTORIAL DE GASTOS</div>
    ${data.gastos.length === 0
      ? '<div class="neg-empty">Sin gastos registrados.</div>'
      : `<div class="neg-list">
          ${data.gastos.slice().reverse().map(g => `
            <div class="neg-list-item" data-gasto-id="${g.id}">
              <div class="neg-li-top">
                <span class="neg-li-name">${_h(g.concepto)}</span>
                <span class="neg-loss">${$MXN(g.monto)}</span>
              </div>
              <div class="neg-li-bot">
                <span>${$DATE(g.fecha)}</span>
                <span class="neg-badge">${TIPOS[g.tipo] || g.tipo}</span>
                <button class="neg-edit" onclick="negEditarGasto('${g.id}')">editar</button>
                <button class="neg-del"  onclick="negEliminarGasto('${g.id}')">✕</button>
              </div>
            </div>`).join('')}
        </div>`}
  `;
}

function negRegistrarGasto() {
  const data     = getNegocioData();
  const tipo     = document.getElementById('neg-g-tipo').value;
  const monto    = parseFloat(document.getElementById('neg-g-monto').value);
  const concepto = document.getElementById('neg-g-concepto').value.trim() || tipo;
  const fechaStr = document.getElementById('neg-g-fecha').value;

  if (!monto || monto <= 0) { alert('Ingresa el monto'); return; }

  const fecha = new Date(fechaStr + 'T12:00:00').getTime();
  data.gastos.push({ id: String(Date.now()), fecha, tipo, concepto, monto });
  saveNegocioData(data);
  renderNegGastos();
}

function negEliminarGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  const data = getNegocioData();
  data.gastos = data.gastos.filter(g => g.id !== id);
  saveNegocioData(data);
  renderNegGastos();
}

function negEditarGasto(id) {
  const data = getNegocioData();
  const g = data.gastos.find(g => g.id === id);
  if (!g) return;
  const el = document.querySelector(`[data-gasto-id="${id}"]`);
  if (!el) return;
  const fechaStr = new Date(g.fecha).toISOString().slice(0, 10);
  const TIPOS = { materia_prima: 'Materia prima', empaque: 'Empaque', transporte: 'Transporte', otro: 'Otro' };
  const opts = Object.entries(TIPOS).map(([v,l]) =>
    `<option value="${v}" ${g.tipo === v ? 'selected' : ''}>${l}</option>`).join('');
  el.innerHTML = `
    <div class="neg-form-row">
      <select id="neg-ge-tipo-${id}" class="neg-select">${opts}</select>
      <input type="number" id="neg-ge-monto-${id}"   class="neg-input" value="${g.monto}" placeholder="Monto" step="1"/>
    </div>
    <div class="neg-form-row">
      <input type="text" id="neg-ge-concepto-${id}" class="neg-input" value="${escAttr(g.concepto)}" placeholder="Descripción"/>
      <input type="date" id="neg-ge-fecha-${id}"    class="neg-input" value="${fechaStr}"/>
    </div>
    <div class="neg-form-row" style="margin-top:0.2rem">
      <button class="neg-btn-primary" onclick="negGuardarEditGasto('${id}')">GUARDAR</button>
      <button class="neg-btn-primary neg-btn-cancel" onclick="renderNegGastos()">CANCELAR</button>
    </div>`;
}

function negGuardarEditGasto(id) {
  const data    = getNegocioData();
  const g       = data.gastos.find(g => g.id === id);
  if (!g) return;
  const monto   = parseFloat(document.getElementById(`neg-ge-monto-${id}`)?.value);
  if (!monto || monto <= 0) { alert('Ingresa el monto'); return; }
  g.tipo      = document.getElementById(`neg-ge-tipo-${id}`)?.value    || g.tipo;
  g.monto     = monto;
  g.concepto  = document.getElementById(`neg-ge-concepto-${id}`)?.value.trim() || g.concepto;
  const fs    = document.getElementById(`neg-ge-fecha-${id}`)?.value;
  if (fs) g.fecha = new Date(fs + 'T12:00:00').getTime();
  saveNegocioData(data);
  renderNegGastos();
}

// ── Configuración ───────────────────────────────────
function renderNegConfig() {
  const data = getNegocioData();
  const cfg  = data.config;
  const costoML  = (cfg.costoKg / cfg.rendimiento) + cfg.costoEmpaque;
  const ganML    = cfg.precioVenta - costoML;
  const margenPct = cfg.precioVenta > 0 ? ((ganML / cfg.precioVenta) * 100).toFixed(1) : 0;

  document.getElementById('neg-cfg-content').innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">PRECIOS Y COSTOS</div>
      <div class="neg-cfg-fila">
        <label>Precio de venta por medio litro ($)</label>
        <input type="number" id="neg-c-pventa"   class="neg-input" value="${cfg.precioVenta}"  step="0.5"/>
      </div>
      <div class="neg-cfg-fila">
        <label>Costo de compra por kilogramo ($)</label>
        <input type="number" id="neg-c-costokg"  class="neg-input" value="${cfg.costoKg}"     step="1"/>
      </div>
      <div class="neg-cfg-fila">
        <label>Rendimiento — medio litros por kg</label>
        <input type="number" id="neg-c-rend"     class="neg-input" value="${cfg.rendimiento}" step="0.1" min="0.1"/>
      </div>
      <div class="neg-cfg-fila">
        <label>Costo de empaque por medio litro ($)</label>
        <input type="number" id="neg-c-empaque"  class="neg-input" value="${cfg.costoEmpaque}" step="0.1"/>
      </div>
      <div class="neg-cfg-fila">
        <label>Meta de ventas mensual ($) — 0 = sin meta</label>
        <input type="number" id="neg-c-meta" class="neg-input" value="${cfg.metaMensual || 0}" step="100" min="0"/>
      </div>
      <div class="neg-cfg-fila">
        <label>Stock mínimo (kg) — alerta cuando baje de este valor</label>
        <input type="number" id="neg-c-stockmin" class="neg-input" value="${cfg.stockMinimo || 5}" step="0.5" min="0"/>
      </div>
      <button class="neg-btn-primary" onclick="negGuardarConfig()">GUARDAR CONFIGURACIÓN</button>
    </div>

    <div class="neg-calc-card">
      <div class="neg-form-title">RENTABILIDAD ACTUAL</div>
      <div class="neg-calc-row"><span>Costo por medio litro</span><span class="neg-loss">${$MXN(costoML)}</span></div>
      <div class="neg-calc-row"><span>Precio de venta</span><span>${$MXN(cfg.precioVenta)}</span></div>
      <div class="neg-calc-row neg-calc-divider"><span>Ganancia por ML</span><span class="${ganML >= 0 ? 'neg-profit' : 'neg-loss'}">${$MXN(ganML)}</span></div>
      <div class="neg-calc-row"><span>Margen de ganancia</span><span class="${ganML >= 0 ? 'neg-profit' : 'neg-loss'}">${margenPct}%</span></div>
    </div>
  `;
}

function negGuardarConfig() {
  const data = getNegocioData();
  const get  = id => parseFloat(document.getElementById(id).value);
  data.config.precioVenta  = get('neg-c-pventa')   || data.config.precioVenta;
  data.config.costoKg      = get('neg-c-costokg')  || data.config.costoKg;
  data.config.rendimiento  = get('neg-c-rend')     || data.config.rendimiento;
  data.config.costoEmpaque = get('neg-c-empaque')  ?? 0;
  data.config.metaMensual  = get('neg-c-meta')     || 0;
  data.config.stockMinimo  = get('neg-c-stockmin') ?? 5;
  saveNegocioData(data);
  renderNegConfig();
}

// ── Init ────────────────────────────────────────────
function initNegocioModule() {
  document.querySelectorAll('#module-negocio .neg-tab').forEach(tab =>
    tab.addEventListener('click', () => switchNegocioView(tab.dataset.view)));
  switchNegocioView('dashboard');
}

function negChartPeriod(p) {
  _negChartPeriod = p;
  renderNegDashboard();
}

// ── Exports globales ────────────────────────────────
window.renderNegocioModule    = () => switchNegocioView('dashboard');
window.negChartPeriod         = negChartPeriod;
window.switchNegocioView      = switchNegocioView;
window.negRegistrarVenta      = negRegistrarVenta;
window.negEliminarVenta       = negEliminarVenta;
window.negEditarVenta         = negEditarVenta;
window.negGuardarEditVenta    = negGuardarEditVenta;
window.negAgregarStock        = negAgregarStock;
window.negAjustarStock        = negAjustarStock;
window.negEliminarHistorial   = negEliminarHistorial;
window.negAgregarSucursal     = negAgregarSucursal;
window.negToggleSucursal      = negToggleSucursal;
window.negEliminarSucursal    = negEliminarSucursal;
window.negEditarSucursal      = negEditarSucursal;
window.negGuardarEditSucursal = negGuardarEditSucursal;
window.negRegistrarGasto      = negRegistrarGasto;
window.negEliminarGasto       = negEliminarGasto;
window.negEditarGasto         = negEditarGasto;
window.negGuardarEditGasto    = negGuardarEditGasto;
window.negGuardarConfig       = negGuardarConfig;
window.negExportarMes         = negExportarMes;
window.negTiendaStats         = negTiendaStats;
window.negRegistrarEntrega    = negRegistrarEntrega;
window.negEliminarEntrega     = negEliminarEntrega;
window.negEntregaUI           = negEntregaUI;
window.renderNegVentas        = renderNegVentas;
window.renderNegSucursales    = renderNegSucursales;
window.renderNegGastos        = renderNegGastos;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNegocioModule);
} else {
  initNegocioModule();
}
