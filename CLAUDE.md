# AREX — reglas de trabajo

Instrucciones permanentes para cualquier sesión que toque este repositorio.

---

## 1 · Regla de oro: todo lo trabajado va a `main`

**Cada tanda de trabajo terminada y verificada se fusiona a `main` y se sube.**
No se acumula en una rama esperando "a que esté todo".

**Por qué existe esta regla.** `.github/workflows/deploy.yml` publica en GitHub
Pages **solo desde `main`**. El iPhone y el Quest de Alexiz cargan lo que haya
ahí. Una rama sin fusionar es invisible para él.

Ya pasó: entre v213 y v220 se hicieron nueve versiones —incluidos dos bugs que
le corrompían datos— y se quedaron en la rama. Cuando dijo *"en verdad no veo
que hayas hecho ningún cambio"*, se interpretó como que el rediseño era
demasiado sutil y se hizo más agresivo. **El diagnóstico era falso: el código
nunca había llegado a su teléfono.** Trabajo desperdiciado y una decisión de
diseño tomada sobre una premisa equivocada.

Consecuencia práctica: si él no puede ver el avance, **da por hecho que ya quedó
cuando no es así**. Fusionar seguido no es una preferencia de proceso — es lo
que mantiene la conversación anclada a la realidad.

Cuando algo no esté listo para producción, se dice explícitamente en el mensaje;
no se resuelve dejándolo sin fusionar.

## 2 · Verificar en un navegador de verdad, siempre

Nada se da por bueno leyendo el código. Se comprueba con Chromium + Playwright,
offline (todas las peticiones externas abortadas), recorriendo AREX como
usuario: clicks reales, datos sembrados, y comparación numérica contra valores
calculados a mano. Nunca "se ve bien".

Ese método es el que encontró: el `@layer` que nunca se cerraba, el `alert()`
que se traga iOS, el `MutationObserver` sobre todo el documento, la búsqueda
global que no encontraba tareas y el bug de la fecha en UTC. Ninguno se ve
leyendo el archivo.

Hay dos contratos, y son distintos **a propósito**:

| contrato | cuándo | qué exige |
|---|---|---|
| **refactor** | el cambio NO debe alterar el aspecto | 0 diferencias de estilo computado sobre ~450 elementos en los 14 módulos. Solo se admiten las de fase de animación (cambian en la 3ª decimal o en 1 px) |
| **rediseño** | el cambio SÍ debe cambiar el aspecto | contraste WCAG sobre el color realmente pintado, objetivos táctiles de 44 px, desbordes y solapes |

Además, antes de fusionar algo grande: **probar el salto desde la versión que
hay en `main`**, con service worker instalado, y confirmar que los datos del
usuario sobreviven y que arranca offline.

## 3 · Migrar borrando, no superponiendo

Cuando un módulo pasa al sistema nuevo (`diseno.css`), **sus reglas viejas se
borran en el mismo commit**.

`style.css` llegó a tener siete pasadas de rediseño apiladas porque cada una
añadía sin quitar: `#dock` definido 12 veces, 411 `!important` que peleaban
entre sí. Añadir una octava capa encima repetiría el problema en vez de
resolverlo.

## 4 · Contexto del dueño

- **Alexiz.** Usa AREX a diario en un **iPhone 16 Pro Max** y en un **Meta
  Quest**, instalado como PWA. No es un proyecto de escritorio.
- **Zona horaria: America/Mexico_City (UTC−6).** Cualquier "hoy" se calcula con
  `hoy()` / `dia()` de `nucleo.js`, **nunca** con `toISOString()`, que es UTC y
  a partir de las 18:00 devuelve el día siguiente.
- Tiene un **negocio real** (venta de frijol con sucursales). Los números de
  Finanzas y Negocio son dinero suyo: un error de cálculo no es cosmético.
- **Se le responde en español.**

## 5 · Restricciones técnicas

- **Sin paso de compilación.** HTML, CSS y JS puro. Nada de Sass, Tailwind,
  bundlers ni `node_modules` en producción. El CSS moderno (anidamiento nativo,
  `oklch()`, `color-mix()`, `@container`, `:has()`) cubre lo que antes obligaba
  a compilar.
- **Lo que depende de la red degrada, no revienta.** AREX tiene que arrancar y
  funcionar sin internet.
- `app.js` y `vision.js` son **módulos ES**: sus declaraciones de nivel superior
  NO son globales. El resto son scripts clásicos con `defer`, donde sí lo son.
- `nucleo.js` se carga **el primero**; `diseno.css`, **el último**. Ese orden es
  significativo: ver los comentarios de cabecera de cada archivo.
- **Nunca** commitear `config.js` — lleva las claves reales y está en
  `.gitignore`.

## 6 · Al terminar cada tanda

1. Suites que apliquen (núcleo, sincronización, widgets, calidad, panel de
   visión) y el contrato que corresponda.
2. Subir la versión en `sw.js` (`CACHE` y `VERSION`) y en `app.js`
   (`AREX_VERSION`). Los tres tienen que coincidir.
3. Commit explicando **qué se rompía y por qué**, no solo qué se cambió.
4. Fusionar a `main` y subir → el despliegue sale solo.
5. Actualizar la hoja de ruta de [`MANUAL.md`](MANUAL.md#4--hoja-de-ruta) y, si
   cambió la estructura, el [`README.md`](README.md).
