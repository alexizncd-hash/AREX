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
    document.querySelectorAll('.subnav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const vista = e.currentTarget.dataset.view;
        this.cambiarVista(vista);
      });
    });

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
  },

  cambiarVista(vista) {
    document.querySelectorAll('.subnav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === vista);
    });
    document.querySelectorAll('.finanzas-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${vista}`).classList.add('active');
    this.vistaActual = vista;

    if (vista === 'dashboard')      this.renderDashboard();
    else if (vista === 'recordatorios') this.renderRecordatorios();
    else if (vista === 'calculadora')   this.renderCalculadora();
  },

  actualizarMetricas() {
    const deudaTotal  = calcularDeudaTotal();
    const gastosTotal = calcularGastosTotal();
    const margen      = calcularMargen();
    const ingreso     = FINANZAS_DATA.config.ingresoMensual;

    document.getElementById('metric-ingreso').textContent = formatearMoneda(ingreso);
    document.getElementById('metric-deuda').textContent   = formatearMoneda(deudaTotal);
    document.getElementById('metric-gastos').textContent  = formatearMoneda(gastosTotal);
    document.getElementById('metric-margen').textContent  = formatearMoneda(margen);
  },

  // ── DASHBOARD ─────────────────────────────────────────

  renderDashboard() {
    this.renderTarjetas();
    this.renderGraficaGastos();
  },

  renderTarjetas() {
    const container = document.getElementById('tarjetas-grid');
    if (!container) return;
    container.innerHTML = '';

    const tarjetasOrdenadas = [...FINANZAS_DATA.tarjetas].sort((a, b) => a.prioridad - b.prioridad);

    tarjetasOrdenadas.forEach(tarjeta => {
      const porcentajeUso   = ((tarjeta.saldo / tarjeta.limite) * 100).toFixed(1);
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
      container.appendChild(card);
    });
  },

  renderGraficaGastos() {
    const container = document.getElementById('gastos-chart');
    if (!container) return;
    container.innerHTML = '';

    const gastosOrdenados = [...FINANZAS_DATA.gastos].sort((a, b) => b.monto - a.monto);
    const totalGastos = calcularGastosTotal();

    gastosOrdenados.forEach(gasto => {
      const porcentaje = ((gasto.monto / totalGastos) * 100).toFixed(1);
      const bar = document.createElement('div');
      bar.className = 'gasto-bar';
      bar.innerHTML = `
        <div class="gasto-info">
          <span class="gasto-icono">${gasto.icono || '📊'}</span>
          <span class="gasto-nombre">${gasto.categoria}</span>
          <span class="gasto-tipo ${gasto.tipo}">${gasto.tipo}</span>
        </div>
        <div class="gasto-barra">
          <div class="gasto-fill" style="width:${porcentaje}%;background:${gasto.color}"></div>
        </div>
        <div class="gasto-valores">
          <span class="gasto-monto">${formatearMoneda(gasto.monto)}</span>
          <span class="gasto-porcentaje">${porcentaje}%</span>
        </div>
      `;
      container.appendChild(bar);
    });
  },

  // ── RECORDATORIOS ──────────────────────────────────────

  renderRecordatorios() {
    this.renderAlertas();
    this.renderCalendario();
    this.renderListaTarjetas();
  },

  renderAlertas() {
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

      const tienePago = FINANZAS_DATA.tarjetas.some(t => t.fechaCorte === dia || t.fechaLimite === dia);
      if (tienePago) {
        el.classList.add('tiene-pago');
        el.innerHTML = `<span class="dia-numero">${dia}</span><span class="dia-indicador">💳</span>`;
      } else {
        el.innerHTML = `<span class="dia-numero">${dia}</span>`;
      }
      container.appendChild(el);
    }
  },

  renderListaTarjetas() {
    const container = document.getElementById('tarjetas-list');
    if (!container) return;
    container.innerHTML = '';

    FINANZAS_DATA.tarjetas.forEach(tarjeta => {
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
  },

  // ── CALCULADORA ────────────────────────────────────────

  renderCalculadora() {
    this.actualizarCalculadora();
  },

  actualizarCalculadora() {
    const simulacion = simularLiquidacion(this.pagoExtraActual, this.estrategiaActual);

    document.getElementById('resultado-meses').textContent = `${simulacion.meses} meses`;

    const fechaLibertad = new Date();
    fechaLibertad.setMonth(fechaLibertad.getMonth() + simulacion.meses);
    document.getElementById('resultado-fecha').textContent =
      fechaLibertad.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });

    const pagoTotal = FINANZAS_DATA.tarjetas.reduce((s, t) => s + t.pagoMinimo + t.pagoMSI, 0) + this.pagoExtraActual;
    document.getElementById('resultado-pago').textContent = formatearMoneda(pagoTotal);

    this.renderOrdenLiquidacion(simulacion.tarjetas);
    this.renderGraficaProyeccion(simulacion.proyeccion);
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
    const canvas = document.getElementById('proyeccion-chart');
    if (!canvas) return;
    const container = canvas.parentElement;
    container.innerHTML = `
      <div class="grafica-placeholder">
        <p>📈 Proyección de ${proyeccion.length} meses</p>
        <p>Deuda inicial: ${formatearMoneda(calcularDeudaTotal())}</p>
        <p>Deuda final: ${formatearMoneda(proyeccion[proyeccion.length - 1]?.total || 0)}</p>
        <p class="nota-grafica">💡 Gráfica detallada disponible próximamente</p>
      </div>
    `;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FinanzasModule.init());
} else {
  FinanzasModule.init();
}
