// ═══════════════════════════════════════════════════════════
// AREX FINANZAS - MÓDULO PRINCIPAL
// Maneja toda la lógica del módulo financiero
// ═══════════════════════════════════════════════════════════

const FinanzasModule = {
  vistaActual: 'dashboard',
  estrategiaActual: 'avalancha',
  pagoExtraActual: 500,

  init() {
    this.setupEventListeners();
    this.renderDashboard();
    this.actualizarMetricas();
  },

  setupEventListeners() {
    // .subnav-btn ya tienen onclick inline en el HTML → no duplicar el listener aquí

    const slider = document.getElementById('pago-extra-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.pagoExtraActual = parseInt(e.target.value);
        document.getElementById('pago-extra-label').textContent = this.pagoExtraActual;
        this.actualizarCalculadora();
      });
    }

    document.querySelectorAll('.strategy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.estrategiaActual = e.currentTarget.dataset.strategy;
        this.actualizarCalculadora();
      });
    });

    document.getElementById('edit-save-btn')?.addEventListener('click', () => this.guardarEditor());
    document.getElementById('edit-reset-btn')?.addEventListener('click', () => {
      resetFinanzasOverrides();
      this.renderEditor();
      this.actualizarMetricas();
    });
    // btn-analizar-ia ya tiene onclick inline en el HTML
  },

  cambiarVista(vista) {
    document.querySelectorAll('.subnav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === vista);
    });
    document.querySelectorAll('.finanzas-view').forEach(v => v.classList.remove('active'));
    const _viewEl = document.getElementById(`view-${vista}`);
    if (!_viewEl) return;
    _viewEl.classList.add('active');
    this.vistaActual = vista;

    if (vista === 'dashboard')        this.renderDashboard();
    else if (vista === 'recordatorios') this.renderRecordatorios();
    else if (vista === 'calculadora')   this.renderCalculadora();
    else if (vista === 'editar')        this.renderEditor();
  },

  actualizarMetricas() {
    const deudaTotal  = calcularDeudaTotal();
    const gastosTotal = calcularGastosTotal();
    const margen      = calcularMargen();
    const ingreso     = getFinanzasData().config.ingresoMensual;

    document.getElementById('metric-ingreso').textContent = formatearMoneda(ingreso);
    document.getElementById('metric-deuda').textContent   = formatearMoneda(deudaTotal);
    document.getElementById('metric-gastos').textContent  = formatearMoneda(gastosTotal);
    document.getElementById('metric-margen').textContent  = formatearMoneda(margen);
  },

  // ── DASHBOARD ─────────────────────────────────────────

  renderDashboard() {
    this.renderTarjetas();
    this.renderGraficaGastos();
    if (typeof renderExchangeWidget === 'function') renderExchangeWidget();
  },

  renderTarjetas() {
    try {
    const container = document.getElementById('tarjetas-grid');
    if (!container) return;
    container.innerHTML = '';

    const tarjetasOrdenadas = [...getFinanzasData().tarjetas].sort((a, b) => a.prioridad - b.prioridad);

    const frag1 = document.createDocumentFragment();
    tarjetasOrdenadas.forEach(tarjeta => {
      const porcentajeUso   = tarjeta.limite > 0 ? ((tarjeta.saldo / tarjeta.limite) * 100).toFixed(1) : '0.0';
      const prioridadTexto  = tarjeta.prioridad === 1 ? 'URGENTE' : tarjeta.prioridad === 2 ? 'ALTA' : 'MEDIA';
      const prioridadClass  = tarjeta.prioridad === 1 ? 'urgente' : tarjeta.prioridad === 2 ? 'alta'  : 'media';

      const card = document.createElement('div');
      card.className = 'tarjeta-card';
      card.style.borderLeftColor = tarjeta.color;

      card.innerHTML = `
        <div class="tarjeta-header">
          <div class="tarjeta-info">
            <h4 class="tarjeta-nombre">${tarjeta.nombre}</h4>
            <span class="tarjeta-numero">${tarjeta.numero}</span>
          </div>
          <div class="tarjeta-prioridad ${prioridadClass}">#${tarjeta.prioridad} ${prioridadTexto}</div>
        </div>
        <div class="tarjeta-metricas">
          <div class="metrica">
            <span class="metrica-label">Saldo</span>
            <span class="metrica-valor">${formatearMoneda(tarjeta.saldo)}</span>
          </div>
          <div class="metrica">
            <span class="metrica-label">CAT</span>
            <span class="metrica-valor cat">${tarjeta.cat}%</span>
          </div>
          <div class="metrica">
            <span class="metrica-label">Interés/mes</span>
            <span class="metrica-valor intereses">${formatearMoneda(tarjeta.interesMensual)}</span>
          </div>
          <div class="metrica">
            <span class="metrica-label">Pago total</span>
            <span class="metrica-valor">${formatearMoneda(tarjeta.pagoMinimo + tarjeta.pagoMSI)}</span>
          </div>
        </div>
        <div class="tarjeta-barra">
          <div class="barra-uso">
            <div class="barra-fill" style="width:${porcentajeUso}%;background:${tarjeta.color}"></div>
          </div>
          <span class="barra-label">Uso: ${porcentajeUso}% del límite</span>
        </div>
        ${tarjeta.notas.length > 0 ? `
          <div class="tarjeta-notas">
            ${tarjeta.notas.map(n => `<div class="nota">• ${n}</div>`).join('')}
          </div>` : ''}
      `;
      frag1.appendChild(card);
    });
    container.appendChild(frag1);
    } catch(e) { typeof logBitacora === 'function' && logBitacora('alerta', 'Error datos renderTarjetas: ' + e.message); }
  },

  renderGraficaGastos() {
    try {
    const container = document.getElementById('gastos-chart');
    if (!container) return;
    container.innerHTML = '';

    const gastosOrdenados = [...getFinanzasData().gastos].sort((a, b) => b.monto - a.monto);
    const totalGastos = calcularGastosTotal();
    const ingreso = getFinanzasData().config.ingresoMensual;

    const frag2 = document.createDocumentFragment();
    gastosOrdenados.forEach(gasto => {
      const pctGastos  = totalGastos > 0 ? ((gasto.monto / totalGastos) * 100).toFixed(1) : '0.0';
      const pctIngreso = ingreso > 0 ? ((gasto.monto / ingreso) * 100).toFixed(1) : '—';
      const bar = document.createElement('div');
      bar.className = 'gasto-bar';
      bar.innerHTML = `
        <div class="gasto-info">
          <span class="gasto-icono">${gasto.icono || '📊'}</span>
          <span class="gasto-nombre">${gasto.categoria}</span>
          <span class="gasto-tipo ${gasto.tipo}">${gasto.tipo}</span>
          ${gasto.reducible ? '<span class="gasto-reducible">↓ reducible</span>' : ''}
        </div>
        <div class="gasto-barra">
          <div class="gasto-fill" style="width:${pctGastos}%;background:${gasto.color}"></div>
        </div>
        <div class="gasto-valores">
          <span class="gasto-monto">${formatearMoneda(gasto.monto)}</span>
          <span class="gasto-porcentaje">${pctGastos}% de gastos</span>
          <span class="gasto-ingreso-pct">${pctIngreso}% del ingreso</span>
        </div>
      `;
      frag2.appendChild(bar);
    });
    container.appendChild(frag2);
    } catch(e) { typeof logBitacora === 'function' && logBitacora('alerta', 'Error datos renderGraficaGastos: ' + e.message); }
  },

  // ── RECORDATORIOS ──────────────────────────────────────

  renderRecordatorios() {
    this.renderAlertas();
    this.renderCalendario();
    this.renderListaTarjetas();
  },

  renderAlertas() {
    try {
    const container = document.getElementById('alertas-urgentes');
    if (!container) return;
    container.innerHTML = '';

    const proximosPagos = obtenerProximosPagos(30);
    const urgentes   = proximosPagos.filter(p => p.urgencia === 'urgente' || p.urgencia === 'hoy');
    const proximos   = proximosPagos.filter(p => p.urgencia === 'proximo');
    const programados = proximosPagos.filter(p => p.urgencia === 'programado');

    const renderSeccion = (lista, cls, titulo) => {
      if (!lista.length) return;
      const sec = document.createElement('div');
      sec.className = `alertas-seccion ${cls}`;
      sec.innerHTML = `<h4 class="alertas-titulo">${titulo}</h4>` +
        lista.map(p => this.crearAlertaPago(p)).join('');
      container.appendChild(sec);
    };

    renderSeccion(urgentes,    'urgente',   '🚨 PAGOS URGENTES (0-3 días)');
    renderSeccion(proximos,    'proxima',   '⚠️ PRÓXIMOS PAGOS (4-7 días)');
    renderSeccion(programados, 'programada','📅 PAGOS PROGRAMADOS (8-30 días)');

    if (!proximosPagos.length) {
      container.innerHTML = '<p class="sin-pagos">✅ No hay pagos próximos en los siguientes 30 días</p>';
    }
    } catch(e) { typeof logBitacora === 'function' && logBitacora('alerta', 'Error datos renderAlertas: ' + e.message); }
  },

  crearAlertaPago(pago) {
    const iconoUrgencia = pago.urgencia === 'hoy' ? '🔴' :
                         pago.urgencia === 'urgente' ? '⚠️' :
                         pago.urgencia === 'proximo' ? '🟡' : '📅';
    const textoUrgencia = pago.urgencia === 'hoy' ? '¡HOY!' :
                         `${pago.diasRestantes} día${pago.diasRestantes !== 1 ? 's' : ''}`;
    return `
      <div class="alerta-pago ${pago.urgencia}">
        <div class="alerta-icono">${iconoUrgencia}</div>
        <div class="alerta-contenido">
          <div class="alerta-tarjeta">${pago.tarjeta}</div>
          <div class="alerta-fecha">${formatearFecha(pago.fechaLimite)}</div>
          <div class="alerta-monto">Pago mínimo: ${formatearMoneda(pago.pagoMinimo)}</div>
        </div>
        <div class="alerta-badge ${pago.urgencia}">${textoUrgencia}</div>
      </div>`;
  },

  renderCalendario() {
    try {
    const container = document.getElementById('calendario');
    if (!container) return;

    const hoy  = new Date();
    const año  = hoy.getFullYear();
    const mes  = hoy.getMonth();
    const diasEnMes  = new Date(año, mes + 1, 0).getDate();
    const primerDia  = new Date(año, mes, 1).getDay();

    container.innerHTML = '';

    ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].forEach(d => {
      const h = document.createElement('div');
      h.className = 'calendario-header';
      h.textContent = d;
      container.appendChild(h);
    });

    for (let i = 0; i < primerDia; i++) {
      const v = document.createElement('div');
      v.className = 'calendario-dia vacio';
      container.appendChild(v);
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const el = document.createElement('div');
      el.className = 'calendario-dia';
      if (dia === hoy.getDate()) el.classList.add('hoy');

      const tienePago = getFinanzasData().tarjetas.some(t => t.fechaCorte === dia || t.fechaLimite === dia);
      if (tienePago) {
        el.classList.add('tiene-pago');
        el.innerHTML = `<span class="dia-numero">${dia}</span><span class="dia-indicador">💳</span>`;
      } else {
        el.innerHTML = `<span class="dia-numero">${dia}</span>`;
      }
      container.appendChild(el);
    }
    } catch(e) { typeof logBitacora === 'function' && logBitacora('alerta', 'Error datos renderCalendario: ' + e.message); }
  },

  renderListaTarjetas() {
    try {
    const container = document.getElementById('tarjetas-list');
    if (!container) return;
    container.innerHTML = '';

    getFinanzasData().tarjetas.forEach(tarjeta => {
      const item = document.createElement('div');
      item.className = 'tarjeta-list-item';
      item.style.borderLeftColor = tarjeta.color;
      item.innerHTML = `
        <div class="list-tarjeta-nombre">${tarjeta.nombre}</div>
        <div class="list-tarjeta-info">
          <div class="list-info-item">
            <span class="list-label">Corte:</span>
            <span class="list-valor">Día ${tarjeta.fechaCorte}</span>
          </div>
          <div class="list-info-item">
            <span class="list-label">Límite pago:</span>
            <span class="list-valor">Día ${tarjeta.fechaLimite}</span>
          </div>
          <div class="list-info-item">
            <span class="list-label">Pago mínimo:</span>
            <span class="list-valor">${formatearMoneda(tarjeta.pagoMinimo)}</span>
          </div>
          <div class="list-info-item">
            <span class="list-label">Pago total:</span>
            <span class="list-valor">${formatearMoneda(tarjeta.pagoMinimo + tarjeta.pagoMSI)}</span>
          </div>
        </div>
      `;
      container.appendChild(item);
    });
    } catch(e) { typeof logBitacora === 'function' && logBitacora('alerta', 'Error datos renderListaTarjetas: ' + e.message); }
  },

  // ── CALCULADORA ────────────────────────────────────────

  renderCalculadora() {
    this.actualizarCalculadora();
  },

  actualizarCalculadora() {
    try {
    const simulacion  = simularLiquidacion(this.pagoExtraActual, this.estrategiaActual);
    const simAlt      = simularLiquidacion(this.pagoExtraActual,
      this.estrategiaActual === 'avalancha' ? 'bola-nieve' : 'avalancha');

    document.getElementById('resultado-meses').textContent = `${simulacion.meses} meses`;

    const fechaLibertad = new Date();
    fechaLibertad.setMonth(fechaLibertad.getMonth() + simulacion.meses);
    document.getElementById('resultado-fecha').textContent =
      fechaLibertad.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });

    const pagoTotal = getFinanzasData().tarjetas.reduce((s, t) => s + t.pagoMinimo + t.pagoMSI, 0) + this.pagoExtraActual;
    document.getElementById('resultado-pago').textContent = formatearMoneda(pagoTotal);

    // Estrategia alternativa
    const altLabel = this.estrategiaActual === 'avalancha' ? 'Bola de nieve' : 'Avalancha';
    const altDiff  = simAlt.meses - simulacion.meses;
    const altEl    = document.getElementById('resultado-alt-estrategia');
    if (altEl) {
      altEl.innerHTML = altDiff !== 0
        ? `${altLabel}: <strong>${simAlt.meses} meses</strong> <span style="color:${altDiff > 0 ? '#ff6644' : '#34ffc3'};font-size:10px;">(${altDiff > 0 ? '+' : ''}${altDiff} meses)</span>`
        : `${altLabel}: misma duración`;
    }

    // Alerta de margen bajo
    const margen = calcularMargen();
    const margenAlertEl = document.getElementById('calc-margen-alert');
    if (margenAlertEl) {
      if (margen < 1000) {
        margenAlertEl.style.display = '';
        margenAlertEl.textContent = `⚠ Margen disponible bajo: ${formatearMoneda(margen)} — considera reducir gastos.`;
      } else {
        margenAlertEl.style.display = 'none';
      }
    }

    this.renderOrdenLiquidacion(simulacion.tarjetas);
    this.renderGraficaProyeccion(simulacion.proyeccion);
    } catch(e) { typeof logBitacora === 'function' && logBitacora('alerta', 'Error datos actualizarCalculadora: ' + e.message); }
  },

  renderOrdenLiquidacion(tarjetas) {
    const container = document.getElementById('orden-list');
    if (!container) return;
    container.innerHTML = '';

    const liquidadas   = tarjetas.filter(t =>  t.liquidada).sort((a, b) => a.mesLiquidacion - b.mesLiquidacion);
    const noLiquidadas = tarjetas.filter(t => !t.liquidada);

    liquidadas.forEach((tarjeta, index) => {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() + tarjeta.mesLiquidacion);
      const item = document.createElement('div');
      item.className = 'orden-item liquidada';
      item.innerHTML = `
        <div class="orden-numero">${index + 1}</div>
        <div class="orden-info">
          <div class="orden-tarjeta">${tarjeta.nombre}</div>
          <div class="orden-mes">Mes ${tarjeta.mesLiquidacion} • ${fecha.toLocaleDateString('es-MX', { month:'short', year:'numeric' })}</div>
        </div>
        <div class="orden-badge liquidada">✓ Liquidada</div>
      `;
      container.appendChild(item);
    });

    noLiquidadas.forEach(tarjeta => {
      const item = document.createElement('div');
      item.className = 'orden-item pendiente';
      item.innerHTML = `
        <div class="orden-info">
          <div class="orden-tarjeta">${tarjeta.nombre}</div>
          <div class="orden-saldo">Saldo restante: ${formatearMoneda(tarjeta.saldo)}</div>
        </div>
        <div class="orden-badge pendiente">⏳ Pendiente</div>
      `;
      container.appendChild(item);
    });
  },

  renderGraficaProyeccion(proyeccion) {
    const container = document.querySelector('.proyeccion-section');
    if (!container) return;
    if (!proyeccion || proyeccion.length < 2) {
      container.innerHTML = '<h4 class="section-subtitle">📈 Proyección de Reducción</h4><p style="color:#4a7a96;font-size:12px;text-align:center;padding:1rem">Sin datos suficientes. Ajusta los parámetros.</p>';
      return;
    }

    container.innerHTML = '<h4 class="section-subtitle">📈 Proyección de Reducción de Deuda</h4><canvas id="proyeccion-chart" style="width:100%;display:block"></canvas>';
    const cv = document.getElementById('proyeccion-chart');
    if (!cv) return;

    const W = cv.parentElement.clientWidth || 320;
    const H = Math.min(180, Math.max(120, Math.round(W * 0.35)));
    cv.width  = W;
    cv.height = H;
    cv.style.height = H + 'px';

    const ctx = cv.getContext('2d');
    const PAD = { top: 14, right: 12, bottom: 28, left: 52 };
    const gW  = W - PAD.left - PAD.right;
    const gH  = H - PAD.top  - PAD.bottom;

    const maxDeuda = Math.max(...proyeccion.map(p => p.total), 1);
    const step     = Math.max(1, Math.floor(proyeccion.length / 6));
    const months   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const now      = new Date();

    // Background
    ctx.fillStyle = 'rgba(0,14,26,0.0)';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(34,211,238,0.07)';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (gH / 4) * i;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + gW, y); ctx.stroke();
      const val = maxDeuda - (maxDeuda / 4) * i;
      ctx.fillStyle = '#4a7a96';
      ctx.font      = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('$' + (val >= 1000 ? (val/1000).toFixed(0) + 'k' : val.toFixed(0)), PAD.left - 4, y + 3);
    }

    // Area fill
    ctx.beginPath();
    proyeccion.forEach((p, i) => {
      const x = PAD.left + (i / (proyeccion.length - 1)) * gW;
      const y = PAD.top  + (1 - p.total / maxDeuda) * gH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const lastX = PAD.left + gW;
    ctx.lineTo(lastX, PAD.top + gH);
    ctx.lineTo(PAD.left, PAD.top + gH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + gH);
    grad.addColorStop(0, 'rgba(34,211,238,0.25)');
    grad.addColorStop(1, 'rgba(34,211,238,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth   = 2;
    proyeccion.forEach((p, i) => {
      const x = PAD.left + (i / (proyeccion.length - 1)) * gW;
      const y = PAD.top  + (1 - p.total / maxDeuda) * gH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Zero line (if debt reaches 0)
    const zeroY = PAD.top + gH;
    ctx.strokeStyle = 'rgba(52,255,195,0.3)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(PAD.left + gW, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // X labels
    ctx.fillStyle = '#4a7a96';
    ctx.font      = '8px monospace';
    ctx.textAlign = 'center';
    proyeccion.forEach((p, i) => {
      if (i % step !== 0 && i !== proyeccion.length - 1) return;
      const x = PAD.left + (i / (proyeccion.length - 1)) * gW;
      const mo = new Date(now.getFullYear(), now.getMonth() + i, 1);
      ctx.fillText(months[mo.getMonth()], x, H - 8);
    });

    // Final dot + label
    const lx = PAD.left + gW;
    const ly = PAD.top + (1 - (proyeccion[proyeccion.length - 1]?.total || 0) / maxDeuda) * gH;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#34ffc3';
    ctx.fill();
    ctx.fillStyle = '#34ffc3';
    ctx.font      = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatearMoneda(proyeccion[proyeccion.length - 1]?.total || 0), lx, ly - 8);
  },

  // ── EDITOR ─────────────────────────────────────────────

  renderEditor() {
    const data = getFinanzasData();
    const fecha = document.getElementById('editor-fecha-actual');
    if (fecha) fecha.textContent = data.config.fechaActualizacion;

    const ingresoEl = document.getElementById('edit-ingreso');
    if (ingresoEl) ingresoEl.value = data.config.ingresoMensual;

    const tarjetasEl = document.getElementById('edit-tarjetas');
    if (tarjetasEl) {
      tarjetasEl.innerHTML = data.tarjetas.map(t => `
        <div class="edit-row">
          <span class="edit-label" style="border-left:3px solid ${t.color}">${t.nombre}</span>
          <div class="edit-fields">
            <div class="edit-field">
              <label>Saldo actual</label>
              <input type="number" class="edit-input" data-tid="${t.id}" data-field="saldo" value="${t.saldo}" min="0">
            </div>
            <div class="edit-field">
              <label>Pago mínimo</label>
              <input type="number" class="edit-input" data-tid="${t.id}" data-field="pagoMinimo" value="${t.pagoMinimo}" min="0">
            </div>
            <div class="edit-field">
              <label>Interés/mes</label>
              <input type="number" class="edit-input" data-tid="${t.id}" data-field="interesMensual" value="${t.interesMensual}" min="0">
            </div>
          </div>
        </div>`).join('');
    }

    const gastosEl = document.getElementById('edit-gastos');
    if (gastosEl) {
      gastosEl.innerHTML = data.gastos.map(g => `
        <div class="edit-row">
          <span class="edit-label">${g.icono || ''} ${g.categoria}</span>
          <div class="edit-fields">
            <div class="edit-field">
              <label>Monto mensual</label>
              <input type="number" class="edit-input" data-gid="${g.id}" data-field="monto" value="${g.monto}" min="0">
            </div>
          </div>
        </div>`).join('');
    }

    document.getElementById('edit-ok')?.classList.add('hidden');
  },

  guardarEditor() {
    const ingreso = parseFloat(document.getElementById('edit-ingreso')?.value) || 0;

    const ALLOWED_TARJETA_FIELDS = new Set(['saldo','pagoMinimo','pagoMSI','interesMensual','limite','disponible']);
    const tarjetas = [];
    document.querySelectorAll('#edit-tarjetas .edit-input[data-tid]').forEach(inp => {
      const id = inp.dataset.tid;
      const field = inp.dataset.field;
      if (!ALLOWED_TARJETA_FIELDS.has(field)) return;
      let entry = tarjetas.find(t => t.id === id);
      if (!entry) { entry = { id }; tarjetas.push(entry); }
      entry[field] = parseFloat(inp.value) || 0;
    });

    const gastos = [];
    document.querySelectorAll('#edit-gastos .edit-input[data-gid]').forEach(inp => {
      gastos.push({ id: inp.dataset.gid, [inp.dataset.field]: parseFloat(inp.value) || 0 });
    });

    const hoy = new Date().toISOString().slice(0, 10);
    saveFinanzasOverrides({
      config: { ingresoMensual: ingreso, fechaActualizacion: hoy },
      tarjetas,
      gastos
    });

    this.actualizarMetricas();
    this.renderDashboard();
    document.getElementById('edit-ok')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('edit-ok')?.classList.add('hidden'), 2500);
  },

  // ── ANALIZAR CON IA ────────────────────────────────────

  analizarConIA() {
    const btn = document.getElementById('btn-analizar-ia');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '⟳ ENVIANDO ANÁLISIS...';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
    }

    const d = getFinanzasData();
    const deuda = calcularDeudaTotal();
    const gastos = calcularGastosTotal();
    const margen = calcularMargen();

    const tarjetasStr = d.tarjetas.map(t =>
      `- ${t.nombre}: $${t.saldo.toLocaleString()} saldo | CAT ${t.cat}% | Interés/mes $${t.interesMensual} | Pago $${t.pagoMinimo + t.pagoMSI} | Prioridad #${t.prioridad}`
    ).join('\n');

    const gastosStr = d.gastos.map(g =>
      `- ${g.categoria}: $${g.monto.toLocaleString()} (${g.tipo}${g.reducible ? ', reducible' : ''})`
    ).join('\n');

    const prompt = `Analiza mi situación financiera REAL y dame un plan de acción concreto:

**INGRESOS**
- Mensual: $${d.config.ingresoMensual.toLocaleString()} | Diario: $${d.config.ingresoDiario || Math.round(d.config.ingresoMensual/30)}

**DEUDAS — Total: $${deuda.toLocaleString()}**
${tarjetasStr}

**GASTOS MENSUALES — Total: $${gastos.toLocaleString()}**
${gastosStr}

**MARGEN DISPONIBLE: $${margen.toLocaleString()}/mes**

Dame: 1) Diagnóstico honesto de mi situación 2) Plan de acción para los próximos 3 meses con montos específicos 3) Qué gastos reducir para acelerar la liquidación 4) Fecha realista de libertad financiera con mi margen actual`;

    if (window.AREXNav) window.AREXNav.cambiarModulo('chat');
    const txt = document.getElementById('txt');
    const btnSend = document.getElementById('btn-send');
    if (txt && btnSend) {
      txt.value = prompt;
      txt.focus();
      btnSend.click();
    }
  }
};

window.FinanzasModule = FinanzasModule; // registrar antes de init() por si init lanza error
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FinanzasModule.init());
} else {
  FinanzasModule.init();
}
