// ═══════════════════════════════════════════════════════════
// AREX FINANZAS - DATOS FINANCIEROS
// Actualiza estos valores cada mes con tu información real
// ═══════════════════════════════════════════════════════════

const FINANZAS_DATA = {

  // 💰 CONFIGURACIÓN GENERAL
  config: {
    ingresoMensual: 11250,
    ingresoDiario: 375,
    fechaActualizacion: '2026-05-12',
    usuario: 'Alexiz Noe Cejudo Duarte'
  },

  // 💳 TARJETAS DE CRÉDITO
  tarjetas: [
    {
      id: 'plata-card',
      nombre: 'Plata Card',
      banco: 'Banco Plata',
      numero: '****9892',
      saldo: 1939,
      limite: 2000,
      disponible: 61,
      tasaAnual: 119.90,
      cat: 228.07,
      interesMensual: 201,
      pagoMinimo: 300,
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
      numero: '****xxxx',
      saldo: 1404,
      limite: 4600,
      disponible: 3196,
      tasaAnual: 68.33,
      cat: 113.3,
      interesMensual: 90,
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
      saldo: 33984,
      limite: 49000,
      disponible: 15015,
      tasaAnual: 48.76,
      cat: 54.1,
      interesMensual: 1188,
      pagoMinimo: 1970,
      pagoMSI: 1723,
      fechaCorte: 1,
      fechaLimite: 21,
      mesLimiteSiguiente: false,
      prioridad: 3,
      color: '#f59e0b',
      clabe: '012975673291910459',
      notas: [
        'Tarjeta compartida con padre',
        'MacStore termina jun-2026 (2 pagos)',
        'Al terminar MSI libera $1,723/mes',
        'NUNCA disposiciones efectivo',
        'Coordinar uso con padre'
      ],
      comprasMSI: [
        {
          comercio: 'MacStore',
          montoOriginal: 30999,
          plazo: 18,
          pagoMensual: 1723,
          pagosRestantes: 2,
          fechaTermino: '2026-06-21'
        }
      ],
      alertas: {
        compartida: true,
        disposicionesEfectivoProhibidas: true
      }
    }
  ],

  // 💸 GASTOS MENSUALES
  gastos: [
    {
      id: 'tarjetas',
      categoria: 'Tarjetas (mínimos)',
      monto: 4356,
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
      { mes: 'Abr 2026', oro: 1188, crea: 90,  plata: 0 }
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
        'Plata Card: $300+',
        'BBVA Crea: $363',
        'BBVA Oro: $3,693',
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
  const raw = localStorage.getItem('arex_finanzas_overrides');
  if (!raw) return FINANZAS_DATA;
  try {
    const ov = JSON.parse(raw);
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
  } catch { return FINANZAS_DATA; }
}

function saveFinanzasOverrides(overrides) {
  localStorage.setItem('arex_finanzas_overrides', JSON.stringify(overrides));
}

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

function calcularMargen() {
  return getFinanzasData().config.ingresoMensual - calcularGastosTotal();
}

function calcularPorcentajeGastos() {
  return ((calcularGastosTotal() / getFinanzasData().config.ingresoMensual) * 100).toFixed(1);
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

    const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));

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
        if (tarjeta.saldo < 0) tarjeta.saldo = 0;
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
