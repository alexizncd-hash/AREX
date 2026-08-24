// ═══════════════════════════════════════════════════════════
// AREX FINANZAS - DATOS FINANCIEROS
// Actualiza estos valores cada mes con tu información real
// ═══════════════════════════════════════════════════════════

const FINANZAS_DATA = {

  // 💰 CONFIGURACIÓN GENERAL
  config: {
    ingresoMensual: 11250,
    ingresoDiario: 375,
    fechaActualizacion: '2026-07-01',
    usuario: 'Alexiz Noe Cejudo Duarte'
  },

  // 💳 TARJETAS DE CRÉDITO
  tarjetas: [
    {
      id: 'plata-card',
      nombre: 'Plata Card',
      banco: 'Banco Plata',
      numero: '****9892',
      saldo: 2564.19,
      limite: 2000,
      disponible: 0,
      tasaAnual: 119.90,
      cat: 228.07,
      interesMensual: 256,
      pagoMinimo: 650,
      pagoMSI: 0,
      fechaCorte: 8,
      fechaLimite: 8,
      mesLimiteSiguiente: true,
      prioridad: 1,
      color: '#dc2626',
      notas: [
        'CAT 228% - USURA total',
        'Cancelar Plata+ ($45/mes)',
        'Cancelar seguro ($23/mes)',
        'Liquidar en 1-2 meses',
        'CANCELAR tarjeta después'
      ],
      alertas: {
        cancelarSuscripciones: true,
        liquidarUrgente: true
      }
    },
    {
      id: 'bbva-crea',
      nombre: 'BBVA Crea',
      banco: 'BBVA',
      numero: '****5537',
      saldo: 2502.97,
      limite: 4600,
      disponible: 2097.03,
      tasaAnual: 67.53,
      cat: 112.4,
      interesMensual: 141,
      pagoMinimo: 363,
      pagoMSI: 0,
      fechaCorte: 1,
      fechaLimite: 21,
      mesLimiteSiguiente: false,
      prioridad: 2,
      color: '#fb923c',
      notas: [
        'Segunda prioridad',
        'Liquidar después de Plata Card',
        'Evitar penalizaciones ($308)'
      ],
      alertas: {
        penalizacionesAnteriores: true
      }
    },
    {
      id: 'bbva-oro',
      nombre: 'BBVA Oro/Gold',
      banco: 'BBVA',
      numero: '****1672',
      saldo: 48552.24,
      limite: 49000,
      disponible: 447.76,
      tasaAnual: 48.55,
      cat: 59.2,
      interesMensual: 1963,
      pagoMinimo: 3552,
      pagoMSI: 2106.66,
      fechaCorte: 1,
      fechaLimite: 21,
      mesLimiteSiguiente: false,
      prioridad: 3,
      color: '#f59e0b',
      clabe: '012975673291910459',
      notas: [
        'Tarjeta compartida con padre',
        'MacStore: pago 15/18 — 3 pagos restantes a $1,723, termina ago-2026',
        'Admin tarjeta titular: $1,151 en 3 MSI a $383.66 — pago 1/3',
        'Al terminar MSI libera ~$2,107/mes',
        'NUNCA disposiciones efectivo',
        'Coordinar uso con padre',
        'ALERTA: 1 pago vencido — comisión cobranza $490+IVA pendiente'
      ],
      comprasMSI: [
        {
          comercio: 'MacStore',
          montoOriginal: 30999,
          plazo: 18,
          pagoMensual: 1723,
          pagosRestantes: 3,
          fechaTermino: '2026-08-21'
        },
        {
          comercio: 'Admin tarjeta titular',
          montoOriginal: 1151,
          plazo: 3,
          pagoMensual: 383.66,
          pagosRestantes: 2,
          fechaTermino: '2026-08-21'
        }
      ],
      alertas: {
        compartida: true,
        disposicionesEfectivoProhibidas: true,
        pagoVencido: true,
        comisionCobranza: 490
      }
    }
  ],

  // 💸 GASTOS MENSUALES
  gastos: [
    {
      id: 'tarjetas',
      categoria: 'Tarjetas (mínimos)',
      monto: 6672,
      tipo: 'deuda',
      esencial: true,
      color: '#ef4444',
      icono: '💳'
    },
    {
      id: 'escuela',
      categoria: 'Escuela',
      monto: 2500,
      tipo: 'fijo',
      esencial: true,
      color: '#3b82f6',
      icono: '📚',
      notas: 'Mensualidad + Reinscripción $4,500 cada cuatrimestre'
    },
    {
      id: 'salidas',
      categoria: 'Salidas novia',
      monto: 1250,
      tipo: 'variable',
      esencial: false,
      color: '#ec4899',
      icono: '💕',
      reducible: true,
      ahorroPotencial: 625
    },
    {
      id: 'gasolina',
      categoria: 'Gasolina',
      monto: 1200,
      tipo: 'variable',
      esencial: true,
      color: '#f59e0b',
      icono: '⛽',
      reducible: true,
      ahorroPotencial: 200
    },
    {
      id: 'calistenia',
      categoria: 'Calistenia',
      monto: 850,
      tipo: 'fijo',
      esencial: false,
      color: '#10b981',
      icono: '💪'
    },
    {
      id: 'comida',
      categoria: 'Comida/personal',
      monto: 750,
      tipo: 'variable',
      esencial: true,
      color: '#8b5cf6',
      icono: '🍽️',
      reducible: true,
      ahorroPotencial: 200
    },
    {
      id: 'telefono',
      categoria: 'Teléfono Telcel',
      monto: 279,
      tipo: 'fijo',
      esencial: true,
      color: '#06b6d4',
      icono: '📱'
    }
  ],

  // 🚫 REGLAS DE ORO
  reglas: [
    {
      id: 'no-disposiciones',
      regla: 'NUNCA disposiciones de efectivo',
      razon: 'Tasa 49%+ costó $21,628 en el pasado',
      criticidad: 'prohibido'
    },
    {
      id: 'pago-anticipado',
      regla: 'SIEMPRE pagar 3 días antes de fecha límite',
      razon: 'Evita penalizaciones $308-490',
      criticidad: 'critico'
    },
    {
      id: 'solo-msi',
      regla: 'SOLO MSI (Meses Sin Intereses)',
      razon: 'Planes con interés cuestan 41.88%+',
      criticidad: 'importante'
    },
    {
      id: 'cancelar-plata',
      regla: 'CANCELAR Plata Card al liquidarla',
      razon: 'CAT 228% es usura',
      criticidad: 'critico'
    },
    {
      id: 'uso-30',
      regla: 'Máximo 30% de uso en tarjetas',
      razon: 'Afecta historial crediticio',
      criticidad: 'importante'
    },
    {
      id: 'apartar-primero',
      regla: 'Apartar dinero ANTES de gastar',
      razon: 'Sistema de apartados BBVA',
      criticidad: 'critico'
    }
  ],

  // 📊 HISTORIAL DE INTERESES PAGADOS
  historialIntereses: {
    meses: [
      { mes: 'Jul 2025', oro: 260,  crea: 0,   plata: 0 },
      { mes: 'Ago 2025', oro: 787,  crea: 0,   plata: 0 },
      { mes: 'Sep 2025', oro: 806,  crea: 0,   plata: 0 },
      { mes: 'Oct 2025', oro: 334,  crea: 0,   plata: 0 },
      { mes: 'Nov 2025', oro: 1070, crea: 0,   plata: 0 },
      { mes: 'Dic 2025', oro: 1408, crea: 36,  plata: 0 },
      { mes: 'Ene 2026', oro: 1566, crea: 74,  plata: 0 },
      { mes: 'Feb 2026', oro: 1456, crea: 103, plata: 0 },
      { mes: 'Mar 2026', oro: 1570, crea: 84,  plata: 0 },
      { mes: 'Abr 2026', oro: 1188, crea: 90,  plata: 0 },
      { mes: 'May 2026', oro: 0,    crea: 0,   plata: 0 }
    ],
    totalIntereses: 10445 + 387 + 3232,
    totalPenalizaciones: 1904,
    totalCostoFinanciero: 15968
  },

  // 🎯 ACCIONES INMEDIATAS
  accionesUrgentes: [
    {
      id: 'cancelar-plata-plus',
      accion: 'Cancelar Plata+',
      ahorro: 45.24,
      frecuencia: 'mensual',
      pasos: [
        'Abrir app Plata Card',
        'Ir a Configuración',
        'Suscripciones → Plata+',
        'Cancelar suscripción'
      ],
      completada: false
    },
    {
      id: 'cancelar-seguro',
      accion: 'Cancelar seguro Plata',
      ahorro: 22.61,
      frecuencia: 'mensual',
      pasos: [
        'Misma app Plata Card',
        'Configuración → Seguros',
        'Cancelar seguro opcional'
      ],
      completada: false
    },
    {
      id: 'transferencia-bancaria',
      accion: 'Cambiar a transferencia bancaria',
      ahorro: 0,
      pasos: [
        'Hablar con empleador',
        'Solicitar transferencia directa',
        'CLABE: 012975673291910459'
      ],
      completada: false
    },
    {
      id: 'configurar-apartados',
      accion: 'Activar apartados BBVA',
      pasos: [
        'App BBVA → Apartados',
        'Plata Card: $650',
        'BBVA Crea: $363',
        'BBVA Oro: $5,659 (mín + MSI)',
        'Gasolina: $300/semana',
        'Escuela: $2,500'
      ],
      completada: false
    }
  ]

};

// ═══════════════════════════════════════════════════════════
// CAPA DE PERSISTENCIA — sobreescrituras en localStorage
// ═══════════════════════════════════════════════════════════

function getFinanzasData() {
  const ov = leer('arex_finanzas_overrides', null);
  if (!ov || typeof ov !== 'object') return FINANZAS_DATA;
  {
    return {
      ...FINANZAS_DATA,
      config: { ...FINANZAS_DATA.config, ...ov.config },
      tarjetas: FINANZAS_DATA.tarjetas.map(t => {
        const o = (ov.tarjetas || []).find(x => x.id === t.id);
        return o ? { ...t, ...o } : t;
      }),
      gastos: FINANZAS_DATA.gastos.map(g => {
        const o = (ov.gastos || []).find(x => x.id === g.id);
        return o ? { ...g, ...o } : g;
      })
    };
  }
}

function saveFinanzasOverrides(overrides) {
  // v206: antes esto no subía a la nube y tus ediciones (saldos, pagos,
  // config) se quedaban en el teléfono. v217: guardar() lo lleva dentro.
  guardar('arex_finanzas_overrides', overrides);
  _publicarSnapshotFinanzas();
}

// Snapshot de los datos financieros efectivos en localStorage 'arex_finanzas'.
// CTRL (agente Hermes), Visión y el backup leen esa key — pero nadie la
// escribía nunca: siempre veían {} y mostraban datos vacíos.
function _publicarSnapshotFinanzas() {
  try {
    const d = getFinanzasData();
    guardar('arex_finanzas', {
      config:   d.config,
      tarjetas: d.tarjetas,
      gastos:   d.gastos,
      ingresoMensual: d.config.ingresoMensual,   // alias plano que usa Visión
      deudas:   d.tarjetas,                      // alias que usa el HUD de Visión
      _updatedAt: Date.now(),
    });
  } catch {}
}
_publicarSnapshotFinanzas();

function resetFinanzasOverrides() {
  localStorage.removeItem('arex_finanzas_overrides');
}

// ═══════════════════════════════════════════════════════════
// FUNCIONES DE CÁLCULO
// ═══════════════════════════════════════════════════════════

function calcularDeudaTotal() {
  return getFinanzasData().tarjetas.reduce((total, t) => total + t.saldo, 0);
}

function calcularGastosTotal() {
  return getFinanzasData().gastos.reduce((total, g) => total + g.monto, 0);
}

// v209: ANTES esta era la fórmula estática (salario − fijos = −2,251 fijo):
// no veía las ventas del negocio ni los gastos personales. La usaban 8 de las
// 9 superficies —incluidos HERMES y el VIGÍA para decidir "¿te alcanza para el
// pago?"— mientras solo el dashboard de INICIO usaba la real. Resultado: dos
// pantallas mostraban números distintos del mismo concepto.
// Ahora DELEGA: un solo margen en todo el sistema.
function calcularMargen() {
  return calcularMargenReal();
}

// La fórmula declarativa original, por si algún cálculo la necesita
// (hoy: ningún llamador). No usar para decisiones de liquidez.
function calcularMargenEstatico() {
  return getFinanzasData().config.ingresoMensual - calcularGastosTotal();
}

function calcularPorcentajeGastos() {
  // v209: dividía entre el ingreso ESTÁTICO ignorando las ventas del negocio
  // v236: y arriba usaba el total con los variables duplicados, así que daba
  // un porcentaje más alto que el real. Ahora usa la misma cuenta que el margen.
  const ingreso = calcularIngresoReal() || 1;
  const salidas = calcularGastosFijos() + calcularVariablesDelMes() + calcularGastosNegocio();
  return ((salidas / ingreso) * 100).toFixed(1);
}

function obtenerProximosPagos(dias = 30) {
  const hoy = new Date();
  const proximosPagos = [];

  getFinanzasData().tarjetas.forEach(tarjeta => {
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();

    let fechaLimite = new Date(año, mes, tarjeta.fechaLimite);
    if (tarjeta.mesLimiteSiguiente) {
      fechaLimite.setMonth(fechaLimite.getMonth() + 1);
    }

    let diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
    // Si la fecha límite de este mes ya pasó, el próximo pago es el del mes
    // siguiente — sin esto la tarjeta desaparecía de recordatorios y las
    // alertas de 1-3 días no sonaban en el cambio de mes
    if (diasRestantes < 0) {
      fechaLimite.setMonth(fechaLimite.getMonth() + 1);
      diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
    }

    if (diasRestantes >= 0 && diasRestantes <= dias) {
      proximosPagos.push({
        tarjeta: tarjeta.nombre,
        fechaLimite: fechaLimite,
        diasRestantes: diasRestantes,
        pagoMinimo: tarjeta.pagoMinimo + tarjeta.pagoMSI,
        urgencia: diasRestantes === 0 ? 'hoy' :
                 diasRestantes <= 3  ? 'urgente' :
                 diasRestantes <= 7  ? 'proximo' : 'programado',
        color: tarjeta.color
      });
    }
  });

  return proximosPagos.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

function simularLiquidacion(pagoExtra, estrategia = 'avalancha') {
  let tarjetasSimulacion = getFinanzasData().tarjetas.map(t => ({
    nombre: t.nombre,
    saldo: t.saldo,
    tasaAnual: t.tasaAnual,
    pagoMinimo: t.pagoMinimo + t.pagoMSI,
    liquidada: false,
    mesLiquidacion: 0
  }));

  if (estrategia === 'avalancha') {
    tarjetasSimulacion.sort((a, b) => b.tasaAnual - a.tasaAnual);
  } else {
    tarjetasSimulacion.sort((a, b) => a.saldo - b.saldo);
  }

  let mes = 0;
  let dineroDisponible = pagoExtra;
  const proyeccion = [];

  while (tarjetasSimulacion.some(t => !t.liquidada) && mes < 120) {
    mes++;

    tarjetasSimulacion.forEach(tarjeta => {
      if (!tarjeta.liquidada) {
        const interesMensual = (tarjeta.saldo * (tarjeta.tasaAnual / 100)) / 12;
        tarjeta.saldo += interesMensual;
        tarjeta.saldo -= tarjeta.pagoMinimo;
        if (tarjeta.saldo <= 0) {
          // Liquidada solo con pagos mínimos: sin esto la simulación con
          // pagoExtra=0 corría 120 meses aunque la deuda llegara a $0
          tarjeta.saldo = 0;
          tarjeta.liquidada = true;
          tarjeta.mesLiquidacion = mes;
          dineroDisponible += tarjeta.pagoMinimo;
        }
      }
    });

    let dineroRestante = dineroDisponible;
    for (let tarjeta of tarjetasSimulacion) {
      if (!tarjeta.liquidada && dineroRestante > 0) {
        const pagoExtraAplicado = Math.min(dineroRestante, tarjeta.saldo);
        tarjeta.saldo -= pagoExtraAplicado;
        dineroRestante -= pagoExtraAplicado;
        if (tarjeta.saldo <= 0) {
          tarjeta.liquidada = true;
          tarjeta.mesLiquidacion = mes;
          dineroDisponible += tarjeta.pagoMinimo;
        }
      }
    }

    proyeccion.push({
      mes: mes,
      total: tarjetasSimulacion.reduce((sum, t) => sum + (t.liquidada ? 0 : t.saldo), 0)
    });
  }

  return { meses: mes, proyeccion: proyeccion, tarjetas: tarjetasSimulacion };
}

function formatearMoneda(cantidad) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cantidad);
}

function formatearFecha(fecha) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(fecha);
}

// Sub-agente Finanzas → reporta a AREX si hay pagos urgentes al iniciar
function checkFinanzasAlerts() {
  if (typeof window.arexAlert !== 'function') return;
  try {
    const pagos = obtenerProximosPagos(3);
    pagos.forEach(p => {
      const dia = p.diasRestantes;
      const etiqueta = dia === 0 ? '¡HOY!' : dia === 1 ? 'mañana' : `en ${dia} días`;
      window.arexAlert('FINANZAS',
        `Pago de ${p.tarjeta} vence ${etiqueta}: ${formatearMoneda(p.pagoMinimo)} mínimo`,
        dia <= 1 ? 'warn' : 'info');
    });
  } catch(e) { console.warn('AREX Finanzas alerts:', e); }
}
// ── Interconnected real-time calculations ─────────────────
// Adds negocio monthly ventas on top of base salary
function calcularIngresoReal() {
  const base = getFinanzasData().config.ingresoMensual;
  try {
    const neg  = JSON.parse(localStorage.getItem('arex_negocio') || '{}');
    const now  = new Date();
    const imTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const vMes = (neg.ventas || []).filter(v => (v.fecha || 0) >= imTs)
                                   .reduce((s, v) => s + (v.total || 0), 0);
    return base + vMes;
  } catch { return base; }
}

// Sum of arex_gastos_pers variable spending for current month
function calcularGastosPers() {
  try {
    const raw    = JSON.parse(localStorage.getItem('arex_gastos_pers') || '{}');
    const gastos = Array.isArray(raw) ? raw : (raw.gastos || []);
    const now    = new Date();
    return gastos.filter(g => {
      if (!g.fecha) return false;
      const d = new Date(g.fecha + 'T12:00:00');
      return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, g) => s + (g.monto || 0), 0);
  } catch { return 0; }
}

// v209: gastos del NEGOCIO del mes (compra de materia prima, empaque...).
// Espejo de calcularIngresoReal: misma clave, mismo filtro por timestamp.
// Nadie los restaba en ningún punto del sistema — el margen salía inflado.
function calcularGastosNegocio() {
  try {
    const neg  = JSON.parse(localStorage.getItem('arex_negocio') || '{}');
    const now  = new Date();
    const imTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return (neg.gastos || [])
      .filter(g => (g.fecha || 0) >= imTs)
      .reduce((s, g) => s + (g.monto || 0), 0);
  } catch { return 0; }
}

/* ═══════════════════════════════════════════════════════════
   v236 · EL MARGEN RESTABA DOS VECES EL MISMO DINERO

   La lista de gastos de FINANZAS tiene tres tipos: `deuda` (mínimos de las
   tarjetas, 6.672), `fijo` (escuela, calistenia, teléfono, 3.629) y
   `variable` (salidas 1.250, gasolina 1.200, comida 750 = 3.200). Los
   variables son un PRESUPUESTO: lo que calculas gastar al mes.

   Y el módulo GASTOS registra lo que gastas DE VERDAD en esas mismas
   categorías: comida, transporte, entretenimiento…

   El margen restaba las dos cosas. Cada peso de comida que anotabas se
   descontaba dos veces: una como presupuesto y otra como gasto real.
   Comprobado en el navegador con datos sembrados: con 500 anotados, AREX
   decía −2.171 cuando el número sin duplicar es −1.671.

   No es cosmético: ése es el número con el que HERMES y el VIGÍA deciden
   "¿te alcanza para el pago de la tarjeta?".

   La regla ahora: los fijos y la deuda se restan siempre; de los variables
   se resta el PRESUPUESTO o lo REALMENTE GASTADO, lo que sea mayor —nunca
   los dos—. Se queda con el mayor a propósito: es dinero, y de dos cifras
   posibles conviene creerse la peor.

   Efecto secundario buscado: si un mes no anotas nada en GASTOS, el número
   sale exactamente igual que antes. Solo cambia cuando sí anotas, que es
   justo donde estaba el error.
   ═══════════════════════════════════════════════════════════ */

/** Los que no se negocian: mínimos de tarjeta y gastos fijos. */
function calcularGastosFijos() {
  return getFinanzasData().gastos
    .filter(g => g.tipo === 'deuda' || g.tipo === 'fijo')
    .reduce((s, g) => s + g.monto, 0);
}

/** Lo presupuestado para los variables (salidas, gasolina, comida). */
function calcularPresupuestoVariable() {
  return getFinanzasData().gastos
    .filter(g => g.tipo === 'variable')
    .reduce((s, g) => s + g.monto, 0);
}

/** Lo variable que cuenta este mes: el presupuesto o lo real, el mayor. */
function calcularVariablesDelMes() {
  return Math.max(calcularPresupuestoVariable(), calcularGastosPers());
}

// Margen real y ÚNICO del sistema:
//   (salario + ventas) − fijos y deuda − variables (presupuesto o real) − gastos del negocio
function calcularMargenReal() {
  return calcularIngresoReal()
       - calcularGastosFijos()
       - calcularVariablesDelMes()
       - calcularGastosNegocio();
}

/** El dinero que REALMENTE ha entrado y salido en lo que va del mes.
    Sin presupuestos: solo hechos. Sirve para ver cómo vas, no para decidir
    si te alcanza —a principio de mes siempre se ve bien—. */
function calcularMargenHoy() {
  return calcularIngresoReal()
       - calcularGastosFijos()
       - calcularGastosPers()
       - calcularGastosNegocio();
}

window.checkFinanzasAlerts   = checkFinanzasAlerts;
window.calcularDeudaTotal    = calcularDeudaTotal;
window.calcularMargen        = calcularMargen;
window.calcularMargenReal    = calcularMargenReal;
window.calcularMargenEstatico = calcularMargenEstatico;
window.calcularGastosNegocio  = calcularGastosNegocio;
window.calcularIngresoReal    = calcularIngresoReal;
window.calcularGastosPers     = calcularGastosPers;
window.calcularGastosTotal   = calcularGastosTotal;
window.calcularGastosFijos   = calcularGastosFijos;
window.calcularPresupuestoVariable = calcularPresupuestoVariable;
window.calcularVariablesDelMes = calcularVariablesDelMes;
window.calcularMargenHoy     = calcularMargenHoy;
window.obtenerProximosPagos  = obtenerProximosPagos;
