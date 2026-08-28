/* ═══════════════════════════════════════════════════════
   AREX — VIERNES · Segundo cerebro analítico
   ───────────────────────────────────────────────────────
   AREX opera el PRESENTE. VIERNES lee el PASADO.

   No es otra IA de chat: es un motor de análisis puramente local.
   Cero API, cero red, cero cuota, cero costo — solo matemática sobre
   tus propios datos.

   CONTRATO DE SEGURIDAD (invariantes que este archivo no rompe nunca):
     · SOLO LECTURA de los datos de los módulos. La única clave que
       escribe es 'arex_viernes' (su caché).
     · Nunca extrapola con muestra insuficiente: cada análisis declara
       su mínimo y devuelve {ok:false, razon} si no lo alcanza.
     · Granularidad máxima: el DÍA. La hora no se conserva en el sistema
       (ventas y gastos de negocio se anclan a las 12:00 local).
   ═══════════════════════════════════════════════════════ */

const VIERNES_KEY = 'arex_viernes';
const DIA_MS = 86400000;

/* ── utilidades ── */
const _vJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fb; } catch { return fb; } };
const _vNeg  = () => _vJSON('arex_negocio', {});
/* Día local 'YYYY-MM-DD'. NO usar toISOString: es UTC y en México
   desplazaría los registros cercanos a medianoche al día siguiente. */
function _vDia(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const _vDiasEntre = (a, b) => Math.round((b - a) / DIA_MS);
const _vProm = arr => arr.length ? arr.reduce((s,x)=>s+x,0) / arr.length : 0;
const _vMediana = arr => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b), m = Math.floor(s.length/2);
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
};
const _vFalta = razon => ({ ok: false, razon });

/* ═══ 1 · AGOTAMIENTO DE INVENTARIO ═══
   Ritmo real de salida = ML vendidos de contado + ML entregados a
   consignación (ambos vacían el inventario central), sobre la ventana
   de días observada. Mínimo: 7 días con movimiento. */
function agotamiento(dias = 21) {
  const neg = _vNeg();
  const rend = neg.config?.rendimiento || 1.8;
  const stockML = Math.floor((neg.inventario?.stockKg || 0) * rend);
  const desde = Date.now() - dias * DIA_MS;

  const sucMap = {};
  (neg.sucursales || []).forEach(s => { sucMap[s.id] = s.modo; });
  const mlVendidos = (neg.ventas || [])
    .filter(v => v.fecha >= desde && sucMap[v.sucursalId] !== 'consignacion')
    .reduce((a,v) => a + (v.cantidad||0), 0);
  const mlEntregados = (neg.entregas || [])
    .filter(e => e.fecha >= desde)
    .reduce((a,e) => a + (e.cantidadML||0), 0);
  const salida = mlVendidos + mlEntregados;

  const eventos = (neg.ventas||[]).filter(v=>v.fecha>=desde).length
                + (neg.entregas||[]).filter(e=>e.fecha>=desde).length;
  if (eventos < 4) return _vFalta(`necesito al menos 4 movimientos en ${dias} días (llevo ${eventos})`);
  if (salida <= 0) return _vFalta('sin salidas de producto en la ventana observada');

  // Días observados reales: desde el primer movimiento, no la ventana entera
  const primeros = [...(neg.ventas||[]), ...(neg.entregas||[])]
    .filter(x => x.fecha >= desde).map(x => x.fecha);
  const obsDias = Math.max(1, _vDiasEntre(Math.min(...primeros), Date.now()));
  const ritmo = salida / obsDias;
  const diasRestantes = ritmo > 0 ? stockML / ritmo : Infinity;
  const agotaEl = new Date(Date.now() + diasRestantes * DIA_MS);

  return {
    ok: true, tipo: 'agotamiento',
    ritmoMLdia: +ritmo.toFixed(1), stockML, diasRestantes: Math.floor(diasRestantes),
    fecha: _vDia(agotaEl.getTime()),
    critico: diasRestantes <= 7,
    texto: `A tu ritmo de los últimos ${obsDias} días (${ritmo.toFixed(1)} ML/día) te quedan `
         + `~${Math.floor(diasRestantes)} días de producto (${stockML} ML). `
         + `Se agota alrededor del ${agotaEl.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'short'})}.`,
  };
}

/* ═══ 2 · RITMO POR TIENDA ═══
   Compara ML vendidos de las últimas 3 semanas contra las 3 previas.
   El más valioso para consignación: detecta la tienda que se enfría
   antes de que el total mensual lo note. */
function ritmoTiendas(semanas = 3) {
  const neg = _vNeg();
  const win = semanas * 7 * DIA_MS;
  const ahora = Date.now();
  const ventas = neg.ventas || [];
  if (ventas.length < 8) return _vFalta(`necesito al menos 8 ventas registradas (llevo ${ventas.length})`);

  const abarca = ahora - Math.min(...ventas.map(v=>v.fecha));
  if (abarca < 2 * win) return _vFalta(`necesito ${semanas*2} semanas de historial (llevo ${Math.floor(abarca/DIA_MS/7)} semanas)`);

  const out = [];
  (neg.sucursales || []).forEach(s => {
    const mias = ventas.filter(v => v.sucursalId === s.id);
    const rec = mias.filter(v => v.fecha >= ahora - win).reduce((a,v)=>a+(v.cantidad||0),0);
    const ant = mias.filter(v => v.fecha >= ahora - 2*win && v.fecha < ahora - win).reduce((a,v)=>a+(v.cantidad||0),0);
    if (ant === 0 && rec === 0) return;
    const cambio = ant > 0 ? ((rec - ant) / ant) * 100 : 100;
    out.push({ tienda: s.nombre, modo: s.modo, recienteML: rec, anteriorML: ant, cambioPct: Math.round(cambio) });
  });
  if (!out.length) return _vFalta('sin ventas por sucursal en el periodo');

  out.sort((a,b) => a.cambioPct - b.cambioPct);
  const caidas = out.filter(t => t.cambioPct <= -25);
  return {
    ok: true, tipo: 'ritmo_tiendas', tiendas: out, caidas,
    critico: caidas.length > 0,
    texto: caidas.length
      ? caidas.map(t => `${t.tienda} bajó ${Math.abs(t.cambioPct)}% en ${semanas} semanas `
          + `(${t.anteriorML} → ${t.recienteML} ML)${t.modo==='consignacion'?' — revisa si está vendiendo o no te está reportando':''}.`).join(' ')
      : `Ninguna tienda cayó más de 25%. La más fuerte: ${out[out.length-1].tienda} (${out[out.length-1].cambioPct>0?'+':''}${out[out.length-1].cambioPct}%).`,
  };
}

/* ═══ 3 · CICLO DE RESURTIDO ═══
   Mediana de días entre entregas por tienda (mediana, no promedio: una
   entrega atípica no distorsiona el ciclo). Mínimo 3 entregas. */
function ciclosResurtido() {
  const neg = _vNeg();
  const ahora = Date.now();
  const out = [];
  (neg.sucursales || []).filter(s => s.modo === 'consignacion').forEach(s => {
    const ent = (neg.entregas||[]).filter(e => e.sucursalId === s.id).sort((a,b)=>a.fecha-b.fecha);
    if (ent.length < 3) return;
    const gaps = [];
    for (let i = 1; i < ent.length; i++) gaps.push(_vDiasEntre(ent[i-1].fecha, ent[i].fecha));
    const ciclo = Math.round(_vMediana(gaps));
    const desde = _vDiasEntre(ent[ent.length-1].fecha, ahora);
    out.push({ tienda: s.nombre, cicloDias: ciclo, diasDesdeUltima: desde,
               toca: desde >= ciclo, atrasada: desde > ciclo * 1.5 });
  });
  if (!out.length) return _vFalta('necesito al menos 3 entregas registradas en alguna tienda de consignación');

  const tocan = out.filter(t => t.toca);
  return {
    ok: true, tipo: 'ciclos', tiendas: out, tocan,
    critico: out.some(t => t.atrasada),
    texto: tocan.length
      ? tocan.map(t => `${t.tienda} pide cada ${t.cicloDias} días y lleva ${t.diasDesdeUltima}`
          + `${t.atrasada ? ' — muy atrasada, revisa si sigue vendiendo' : ' — ya toca'}.`).join(' ')
      : `Ninguna tienda toca resurtido todavía. La más próxima: `
        + `${out.sort((a,b)=>(b.diasDesdeUltima/b.cicloDias)-(a.diasDesdeUltima/a.cicloDias))[0].tienda}.`,
  };
}

/* ═══ 4 · MEJOR DÍA DE VENTA ═══
   Agrupa por día de la semana. Es el análisis que la granularidad del
   sistema sí sostiene (la hora no se guarda). Mínimo 3 semanas. */
function mejorDia() {
  const neg = _vNeg();
  const ventas = neg.ventas || [];
  if (ventas.length < 12) return _vFalta(`necesito al menos 12 ventas (llevo ${ventas.length})`);
  const abarca = _vDiasEntre(Math.min(...ventas.map(v=>v.fecha)), Date.now());
  if (abarca < 21) return _vFalta(`necesito 3 semanas de ventas (llevo ${abarca} días)`);

  const nombres = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const porDia = Array.from({length:7}, () => ({ ml: 0, dias: new Set() }));
  ventas.forEach(v => {
    const d = new Date(v.fecha);
    porDia[d.getDay()].ml += v.cantidad || 0;
    porDia[d.getDay()].dias.add(_vDia(v.fecha));
  });
  /* v242 · El promedio se hacía dividiendo entre los días en que HUBO venta,
     no entre las veces que ese día de la semana cayó dentro del periodo
     observado. Con seis viernes vendiendo 20 ML y UN domingo suelto de 40,
     declaraba "tu mejor día es el domingo, 2× lo que vendes el viernes" —y
     sobre eso decides dónde surtir—. Ahora se divide entre las veces que ese
     día ocurrió de verdad en la ventana. */
  const primera = new Date(Math.min(...ventas.map(v => v.fecha)));
  const ultima  = new Date(Math.max(...ventas.map(v => v.fecha)));
  const vecesDelDia = Array.from({length:7}, () => 0);
  for (const d = new Date(primera); d <= ultima; d.setDate(d.getDate() + 1)) {
    vecesDelDia[d.getDay()]++;
  }
  const prom = porDia.map((p,i) => ({
                       dia: nombres[i],
                       promML: vecesDelDia[i] ? p.ml / vecesDelDia[i] : 0,
                       veces: vecesDelDia[i], dias: p.dias.size }))
                     .filter(p => p.promML > 0).sort((a,b)=>b.promML-a.promML);
  if (prom.length < 3) return _vFalta('necesito ventas en al menos 3 días distintos de la semana');
  const mejor = prom[0], peor = prom[prom.length-1];
  const ratio = peor.promML > 0 ? (mejor.promML/peor.promML) : 0;
  return {
    ok: true, tipo: 'mejor_dia', ranking: prom, critico: false,
    texto: `Tu mejor día es el ${mejor.dia} (${mejor.promML.toFixed(1)} ML en promedio)`
         + (ratio >= 1.5 ? `, ${ratio.toFixed(1)}× lo que vendes el ${peor.dia}.` : '.'),
  };
}

/* ═══ 5 · ESTACIONALIDAD DE GASTO ═══
   Compara el gasto de la última semana del mes contra el promedio de
   las primeras tres, sobre varios meses. Mínimo 2 meses. */
function ritmoGasto() {
  const raw = _vJSON('arex_gastos_pers', { gastos: [] });
  const gastos = Array.isArray(raw) ? raw : (raw.gastos || []);
  if (gastos.length < 20) return _vFalta(`necesito al menos 20 gastos registrados (llevo ${gastos.length})`);

  /* v242 · Esta cuenta dividía entre días que no existen y metía el mes en
     curso —que va a medias— en la muestra. Los días 23 en adelante son 9 en
     un mes de 31, 8 en uno de 30 y solo 6 en febrero; dividir siempre entre
     8 subestimaba febrero un 25 %. Y el mes actual, en su día 10, aporta
     `fin = 0`, o sea ratio 0: bastaba para que VIERNES afirmara "tus gastos
     BAJAN un 23 % la última semana del mes, patrón consistente en 3 meses"
     cuando pasaba justo lo contrario. Ahora se excluye el mes en curso y se
     divide entre los días reales de cada tramo. */
  const mesActual = window.mes ? window.mes() : new Date().toISOString().slice(0, 7);
  const meses = {};
  gastos.forEach(g => {
    if (!g.fecha) return;
    const mes = g.fecha.slice(0,7), dia = +g.fecha.slice(8,10);
    if (!mes || !dia) return;
    if (mes >= mesActual) return;              // el mes en curso está a medias
    (meses[mes] = meses[mes] || { fin: 0, resto: 0 })[dia >= 23 ? 'fin' : 'resto'] += (g.monto||0);
  });
  const keys = Object.keys(meses);
  if (keys.length < 2) return _vFalta(`necesito 2 meses COMPLETOS de gastos (llevo ${keys.length})`);

  const ratios = keys.map(m => {
    const { fin, resto } = meses[m];
    const [y, mm] = m.split('-').map(Number);
    const diasDelMes = new Date(y, mm, 0).getDate();      // 28, 29, 30 o 31
    const diasFin    = Math.max(1, diasDelMes - 22);      // del 23 al último
    const diasResto  = 22;
    const promDiaResto = resto / diasResto, promDiaFin = fin / diasFin;
    return promDiaResto > 0 ? promDiaFin / promDiaResto : null;
  }).filter(x => x !== null && isFinite(x));
  if (!ratios.length) return _vFalta('sin gastos suficientes en las primeras semanas del mes');

  const r = _vProm(ratios);
  const subePct = Math.round((r - 1) * 100);
  return {
    ok: true, tipo: 'ritmo_gasto', ratio: +r.toFixed(2), meses: keys.length,
    critico: subePct >= 40,
    texto: Math.abs(subePct) < 15
      ? `Tu gasto es parejo a lo largo del mes (${keys.length} meses analizados).`
      : `Tus gastos ${subePct>0?'suben':'bajan'} ${Math.abs(subePct)}% en la última semana del mes, `
        + `patrón consistente en ${keys.length} meses.`,
  };
}

/* ═══ API pública ═══ */
function analizar() {
  const t0 = performance.now();
  const res = {
    agotamiento:  _try(agotamiento),
    ritmoTiendas: _try(ritmoTiendas),
    ciclos:       _try(ciclosResurtido),
    mejorDia:     _try(mejorDia),
    ritmoGasto:   _try(ritmoGasto),
  };
  res._ms = Math.round(performance.now() - t0);
  res._ts = Date.now();
  // ÚNICA escritura de todo el módulo, y solo sobre su propia clave
  try { localStorage.setItem(VIERNES_KEY, JSON.stringify({ ts: res._ts, ms: res._ms })); } catch {}
  return res;
}
function _try(fn) { try { return fn(); } catch (e) { return _vFalta('error de cálculo: ' + e.message); } }

/* Predicciones vigentes listas para VIGÍA o para el prompt del chat */
function insights({ soloCriticos = false } = {}) {
  const a = analizar();
  return Object.values(a)
    .filter(x => x && x.ok && (!soloCriticos || x.critico))
    .map(x => ({ tipo: x.tipo, critico: !!x.critico, texto: x.texto }));
}

window.VIERNES = { analizar, insights, agotamiento, ritmoTiendas, ciclosResurtido, mejorDia, ritmoGasto };
