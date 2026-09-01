/* ═══════════════════════════════════════════════════════════════
   AREX · NÚCLEO  (v216)

   La base común que AREX no tenía. Hasta ahora cada módulo resolvía
   por su cuenta las mismas cuatro cosas —qué día es hoy, guardar en
   disco, preguntarle algo al usuario, escapar HTML— y en dos de ellas
   lo hacía mal. Este archivo las resuelve UNA vez.

   Se carga con `defer` ANTES que cualquier otro módulo, así que sus
   funciones están disponibles como globales en todos ellos.

   Los dos bugs que corrige de raíz están explicados en su sitio, más
   abajo: HOY (fechas) y PREGUNTA/AVISO (diálogos).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════
     1 · FECHAS

     EL BUG: en 18 sitios repartidos por 8 archivos se calculaba el
     día de hoy con `new Date().toISOString().slice(0, 10)`.
     toISOString() devuelve la fecha en UTC. México va en UTC-6, así
     que **a partir de las 18:00 hora local, toISOString() ya dice el
     día siguiente**. Comprobado en el navegador con el huso puesto en
     America/Mexico_City:

         08:30 local → 2026-08-21  ✓
         17:30 local → 2026-08-21  ✓
         18:30 local → 2026-08-22  ✗ un día de más
         23:30 local → 2026-08-22  ✗ un día de más

     Consecuencias reales, no teóricas: una venta registrada al cerrar
     el local a las 21:00 se guardaba en el día siguiente; un hábito
     marcado por la noche no contaba para hoy y rompía la racha; el
     briefing del día miraba el día equivocado.

     `hoy()` usa los componentes locales de la fecha, que es lo que
     siempre se quiso decir.
     ════════════════════════════════════════════════════════════ */

  /** Día local en formato YYYY-MM-DD. Sustituye a toISOString().slice(0,10). */
  function dia(fecha) {
    const d = fecha == null ? new Date()
            : (fecha instanceof Date ? fecha : new Date(fecha));
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Hoy, en local. */
  const hoy = () => dia();

  /** Mes local en formato YYYY-MM. */
  function mes(fecha) { return dia(fecha).slice(0, 7); }

  /** Marca de tiempo del primer instante del mes en curso, en local. */
  function inicioMes() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
  }

  /** Días de diferencia entre dos fechas, contando por día local. */
  function diasEntre(a, b) {
    const [x, y] = [a, b].map(f => { const d = f instanceof Date ? f : new Date(f);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); });
    return Math.round((y - x) / 86400000);
  }

  /* ════════════════════════════════════════════════════════════
     2 · DIÁLOGOS

     EL BUG: había 35 llamadas a alert(), confirm() y prompt()
     repartidas por 8 archivos —18 solo en negocio.js—. En una PWA
     instalada en iOS esos diálogos nativos no son de fiar: se
     suprimen sin avisar y la función que los llamó se queda a medias.
     En este mismo proyecto ya nos mordió tres veces: en FORJA (v190),
     en REPARTO (v205) y en la transferencia al Quest (v206), y las
     tres veces se arregló a mano y solo en ese sitio.

     Aquí se resuelve para todos: mismos nombres cortos, misma pinta
     que el resto de AREX, y `pregunta()` devuelve una promesa para
     poder escribir `if (await pregunta('¿Borrar?'))`.
     ════════════════════════════════════════════════════════════ */

  let _capa = null;

  function _construir() {
    if (_capa) return _capa;
    _capa = document.createElement('div');
    _capa.id = 'nucleo-dialogo';
    _capa.innerHTML = `
      <div class="ndlg-fondo"></div>
      <div class="ndlg-caja" role="dialog" aria-modal="true">
        <div class="ndlg-titulo"></div>
        <div class="ndlg-texto"></div>
        <input class="ndlg-input" type="text" />
        <div class="ndlg-botones">
          <button class="ndlg-btn ndlg-cancelar" type="button">Cancelar</button>
          <button class="ndlg-btn ndlg-aceptar"  type="button">Aceptar</button>
        </div>
      </div>`;
    document.body.appendChild(_capa);
    return _capa;
  }

  function _abrir({ titulo, texto, tipo, valor, aceptar, cancelar }) {
    return new Promise(resolve => {
      const c = _construir();
      const $ = s => c.querySelector(s);
      $('.ndlg-titulo').textContent = titulo || '';
      $('.ndlg-titulo').style.display = titulo ? '' : 'none';
      $('.ndlg-texto').textContent = texto || '';
      const inp = $('.ndlg-input');
      inp.style.display = tipo === 'prompt' ? '' : 'none';
      inp.value = valor || '';
      $('.ndlg-cancelar').style.display = tipo === 'aviso' ? 'none' : '';
      $('.ndlg-cancelar').textContent = cancelar || 'Cancelar';
      $('.ndlg-aceptar').textContent  = aceptar  || 'Aceptar';
      c.classList.add('abierto');

      const cerrar = valorFinal => {
        c.classList.remove('abierto');
        document.removeEventListener('keydown', teclas);
        resolve(valorFinal);
      };
      const teclas = e => {
        if (e.key === 'Escape') cerrar(tipo === 'prompt' ? null : false);
        if (e.key === 'Enter' && tipo !== 'prompt') aceptarYa();
      };
      const aceptarYa = () => cerrar(tipo === 'prompt' ? inp.value : true);

      $('.ndlg-aceptar').onclick  = aceptarYa;
      $('.ndlg-cancelar').onclick = () => cerrar(tipo === 'prompt' ? null : false);
      $('.ndlg-fondo').onclick    = () => cerrar(tipo === 'prompt' ? null : false);
      inp.onkeydown = e => { if (e.key === 'Enter') aceptarYa(); };
      document.addEventListener('keydown', teclas);
      setTimeout(() => (tipo === 'prompt' ? inp : $('.ndlg-aceptar')).focus(), 60);
    });
  }

  /** Aviso de una sola salida. Sustituye a alert(). */
  const aviso = (texto, titulo) =>
    _abrir({ titulo, texto, tipo: 'aviso', aceptar: 'Entendido' });

  /** Confirmación. Sustituye a confirm(). `await pregunta('¿Seguro?')` → true/false. */
  const pregunta = (texto, titulo, aceptar) =>
    _abrir({ titulo, texto, tipo: 'confirmar', aceptar: aceptar || 'Sí' });

  /** Entrada de texto. Sustituye a prompt(). Devuelve el texto o null. */
  const pedirTexto = (texto, valor, titulo) =>
    _abrir({ titulo, texto, tipo: 'prompt', valor });

  /** Mensaje efímero, sin botones — para confirmar que algo se guardó. */
  let _tostTimer = null;
  function tost(texto, tono) {
    let t = document.getElementById('nucleo-tost');
    if (!t) { t = document.createElement('div'); t.id = 'nucleo-tost'; document.body.appendChild(t); }
    t.textContent = texto;
    t.className = 'visible' + (tono ? ' ' + tono : '');
    clearTimeout(_tostTimer);
    _tostTimer = setTimeout(() => { t.className = ''; }, 2600);
  }

  /* ════════════════════════════════════════════════════════════
     3 · ALMACENAMIENTO

     Ocho módulos hacían el mismo par: JSON.parse dentro de un
     try/catch para leer, y JSON.stringify + arexSyncData() para
     escribir. Cuando alguien olvidaba la llamada a arexSyncData —pasó
     en reparto (v205), en finanzas (v206) y en visión (v208)— ese
     módulo dejaba de sincronizar con la nube sin dar ninguna señal.
     Con guardar() no se puede olvidar: la sincronización va dentro.
     ════════════════════════════════════════════════════════════ */

  /** Lee una clave y devuelve el objeto, o `porDefecto` si no hay o está rota. */
  function leer(clave, porDefecto) {
    try {
      const raw = localStorage.getItem(clave);
      if (raw == null) return porDefecto;
      const v = JSON.parse(raw);
      return v == null ? porDefecto : v;
    } catch { return porDefecto; }
  }

  /** Guarda y sincroniza. Devuelve false si el disco está lleno. */
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); }
    catch (e) {
      console.warn('[núcleo] no se pudo guardar', clave, e);
      tost('No se pudo guardar: almacenamiento lleno', 'error');
      return false;
    }
    try { window.arexSyncData?.(clave); } catch {}
    return true;
  }

  /* ════════════════════════════════════════════════════════════
     4 · TEXTO Y NÚMEROS
     ════════════════════════════════════════════════════════════ */

  /** Escapa para insertar como TEXTO dentro de HTML. */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g,
      ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  /** Escapa para meter dentro de un atributo entre comillas. */
  const escAttr = s => esc(s).replace(/\n/g, '&#10;');

  /** Pesos mexicanos. Reutiliza formatearMoneda si finanzas-data.js ya cargó. */
  function dinero(n) {
    if (typeof window.formatearMoneda === 'function') return window.formatearMoneda(n);
    const v = Number(n) || 0;
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  }

  /* ── Se publican con nombres cortos, sin prefijo: son el vocabulario
        base del sistema y van a aparecer en todos los módulos. ── */
  /* ════════════════════════════════════════════════════════════
     5 · HOJAS DE ESTILO BAJO DEMANDA

     EL PROBLEMA: index.html cargaba 16 hojas antes de pintar nada —388 KB,
     2.158 reglas— y once de ellas son de un módulo concreto. La de reparto
     no hace falta para ver el escritorio, y la de finanzas tampoco. Todo eso
     se descargaba y se analizaba en el camino crítico del arranque.

     LA REGLA QUE NO SE PUEDE ROMPER: `diseno.css` va el último. Si una hoja
     de módulo se añade al final del <head> —que es lo que hacía el _lazyCSS
     de v218— queda DESPUÉS y le gana al sistema de diseño por orden de
     fuente. Por eso aquí se inserta siempre ANTES de diseno.css: el orden
     del documento queda igual que si estuviera escrita en el HTML.
     ════════════════════════════════════════════════════════════ */

  const _hojas = new Map();   // href → Promise

  /** Carga una hoja de estilos respetando el orden de la cascada. */
  function arexCss(href) {
    if (_hojas.has(href)) return _hojas.get(href);
    const ya = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (ya) { const p = Promise.resolve(); _hojas.set(href, p); return p; }

    const p = new Promise(res => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = l.onerror = () => res();
      const ultima = document.querySelector('link[rel="stylesheet"][href$="diseno.css"]');
      if (ultima) ultima.parentNode.insertBefore(l, ultima);
      else document.head.appendChild(l);
    });
    _hojas.set(href, p);
    return p;
  }

  /** ¿Ya está pedida esta hoja? (para no retrasar una apertura sin motivo) */
  const cssListo = href => _hojas.has(href) && !!document
    .querySelector(`link[rel="stylesheet"][href="${href}"]`)?.sheet;

  const CSS_MODULOS = {
    finanzas: 'finanzas.css', negocio: 'negocio.css', gastos: 'gastos.css',
    metas: 'metas.css', proyectos: 'proyectos.css', evidencias: 'evidencias.css',
    control: 'control.css', reparto: 'reparto.css', agenda: 'agenda.css',
    habitos: 'habitos.css',
  };

  /** La hoja que necesita un módulo, o nada si no tiene. */
  function cssModulo(mod) {
    const h = CSS_MODULOS[mod];
    return h ? arexCss(h) : Promise.resolve();
  }
  const cssModuloListo = mod => !CSS_MODULOS[mod] || cssListo(CSS_MODULOS[mod]);

  /* En cuanto la app termina de arrancar se traen todas en segundo plano, así
     que para cuando toques un módulo ya están. Y quedan en la caché del
     service worker, que las guarda igual: sin internet siguen ahí. */
  function precargarCSS() {
    const todas = [...Object.values(CSS_MODULOS), 'search.css'];
    const ocioso = window.requestIdleCallback || (f => setTimeout(f, 400));
    ocioso(() => todas.forEach(h => arexCss(h)));
  }
  if (document.readyState === 'complete') precargarCSS();
  else window.addEventListener('load', precargarCSS);




  /* ════════════════════════════════════════════════════════════
     6 · CAMPOS DE CLAVE

     Las claves de API van en <input type="password">, y con razón. Pero eso
     hace que pegarlas desde el teléfono sea a ciegas: solo ves puntitos, y
     una clave a medias no da error —el servicio contesta 403 y el módulo no
     funciona, sin decir por qué—. Además, el menú "Pegar" de iOS a veces no
     aparece, y entonces no hay forma de meterla.

     Esto ya existió en v228/v229 y lo quité en v230 porque sospechaba que
     era la causa de la pantalla negra. NO lo era: las causas reales
     resultaron ser el arranque que moría entero por un solo paso (v238) y un
     bucle de microtareas al cargar el CSS de un módulo (v238). Vuelve, pero
     ahora cada pieza va dentro de su propio try: si algo falla aquí te
     quedas sin botón, nunca sin app.
     ════════════════════════════════════════════════════════════ */

  const OCULTAR_TRAS = 12000;

  const OJO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/>' +
    '<circle cx="12" cy="12" r="2.8"/></svg>';
  const OJO_TACHADO = OJO.replace('</svg>', '<path d="M4 20 20 4"/></svg>');

  function _prepararCampoClave(inp) {
   try {
    if (inp.dataset.nxClave) return;
    inp.dataset.nxClave = '1';
    const esClave = inp.type === 'password';

    // El teclado de iOS pone mayúscula a la primera letra y "corrige" lo que
    // escribes. Una clave escrita a mano llegaba alterada sin avisar.
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('autocorrect', 'off');
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('spellcheck', 'false');

    const env = document.createElement('span');
    env.className = 'nx-clave' + (esClave ? ' con-ojo' : '');
    inp.parentNode.insertBefore(env, inp);
    env.appendChild(inp);

    /* ── Botón PEGAR ──────────────────────────────────────────────────────
       El menú de "Pegar" de iOS aparece al mantener pulsado, pero solo si el
       portapapeles tiene algo Y el sistema quiere: en la práctica desaparece
       a menudo y no hay forma de saber por qué. Este botón lee el
       portapapeles directamente; en iOS sale la confirmación del sistema y
       ya está. Y cuando falla, lo dice en vez de no hacer nada. */
    const pegar = document.createElement('button');
    pegar.type = 'button';
    pegar.className = 'nx-clave-pegar';
    pegar.textContent = 'PEGAR';
    pegar.setAttribute('aria-label', 'Pegar desde el portapapeles');
    env.appendChild(pegar);

    pegar.addEventListener('click', async () => {
      let txt = '';
      try { txt = await navigator.clipboard.readText(); }
      catch (e) {
        tost('El navegador no dejó leer el portapapeles. Mantén pulsado el campo y elige Pegar.', 'error');
        return;
      }
      txt = String(txt || '').replace(/\s+/g, '');
      if (!txt) { tost('El portapapeles está vacío: copia primero la clave', 'error'); return; }
      inp.value = txt;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      tost('Pegado · ' + resumenClave(txt), 'ok');
    });

    // Al pegar, quitar espacios y saltos de línea: se arrastran al copiar
    // en el móvil y una clave con un espacio delante falla en silencio.
    inp.addEventListener('paste', () => setTimeout(() => {
      const limpio = inp.value.replace(/\s+/g, '');
      if (limpio !== inp.value) {
        inp.value = limpio;
        tost('Se quitaron espacios de la clave pegada');
      }
    }, 0));

    if (!esClave) return;   // los que no son secretos se quedan sin ojo

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nx-clave-ojo';
    btn.setAttribute('aria-label', 'Mostrar la clave');
    btn.innerHTML = OJO;
    env.appendChild(btn);

    let t = null;
    const ocultar = () => { inp.type = 'password'; btn.innerHTML = OJO;
                            btn.setAttribute('aria-label', 'Mostrar la clave');
                            clearTimeout(t); };
    btn.addEventListener('click', () => {
      if (inp.type === 'password') {
        inp.type = 'text'; btn.innerHTML = OJO_TACHADO;
        btn.setAttribute('aria-label', 'Ocultar la clave');
        clearTimeout(t); t = setTimeout(ocultar, OCULTAR_TRAS);
      } else ocultar();
    });
   } catch (e) { console.warn('[núcleo] campo de clave:', e); }
  }

  /** Prepara todos los campos de configuración que haya en pantalla. */
  function prepararClaves(raiz) {
    try {
      (raiz || document).querySelectorAll('input.cfg-input').forEach(_prepararCampoClave);
    } catch (e) { console.warn('[núcleo] prepararClaves:', e); }
  }

  /** Resumen seguro de una clave: cuántos caracteres y sus extremos. */
  function resumenClave(v) {
    const s = String(v || '').trim();
    if (!s) return 'vacía';
    if (s.length <= 10) return `${s.length} caracteres`;
    return `${s.length} caracteres · ${s.slice(0, 4)}…${s.slice(-4)}`;
  }

  /** Aviso de lo que se guardó, sin enseñar ninguna clave entera. */
  function avisarClavesGuardadas(cfg) {
    const nombres = { groqKey:'Groq', tavilyKey:'Tavily', geminiKey:'Gemini',
                      owmKey:'Clima', tomtomKey:'TomTom' };
    const puestas = Object.entries(nombres)
      .filter(([k]) => cfg?.[k])
      .map(([k, n]) => `${n} ${resumenClave(cfg[k])}`);
    tost(puestas.length ? 'Guardado · ' + puestas.join(' · ') : 'Guardado', 'ok');
  }

  /* ── Se publican con nombres cortos, sin prefijo: son el vocabulario
        base del sistema y van a aparecer en todos los módulos. ── */
  Object.assign(window, {
    arexCss, cssModulo, cssModuloListo,
    prepararClaves, resumenClave, avisarClavesGuardadas,
    hoy, dia, mes, inicioMes, diasEntre,
    aviso, pregunta, pedirTexto, tost,
    leer, guardar,
    esc, escAttr, dinero,
  });

  /* Los campos de clave se preparan AQUÍ, al final, y no allá arriba:
     nucleo.js se carga con defer, así que cuando corre el DOM ya está listo
     y la llamada se hacía en el acto… desde un punto del archivo anterior a
     la declaración de las constantes del icono. Resultado: ReferenceError por
     zona muerta temporal, el ojo no se montaba, y solo se veía porque el try
     lo dejó escrito en la consola. */
  try {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', () => prepararClaves());
    else prepararClaves();
  } catch (e) { console.warn('[núcleo] claves:', e); }
  window.AREXNucleo = { hoy, dia, mes, inicioMes, diasEntre, aviso, pregunta,
                        pedirTexto, tost, leer, guardar, esc, escAttr, dinero };
})();
