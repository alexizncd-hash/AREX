# AREX — Guía de configuración Firebase (Google Sign-In)

## Paso 1 — Activar Google como método de inicio de sesión

1. Abre la consola de Firebase: https://console.firebase.google.com
2. Selecciona tu proyecto AREX
3. En el menú izquierdo haz clic en **Authentication**
4. Ve a la pestaña **Sign-in method** (Métodos de acceso)
5. Busca **Google** en la lista y haz clic en él
6. Activa el interruptor **Enable** (Habilitar)
7. En el campo "Project support email", selecciona tu correo
8. Guarda con el botón **Save**

---

## Paso 2 — Agregar dominio autorizado (GitHub Pages)

Para que el popup de Google funcione desde tu URL de GitHub Pages:

1. En **Authentication** → pestaña **Settings** → sección **Authorized domains**
2. Haz clic en **Add domain**
3. Agrega: `alexizncd-hash.github.io` (o tu dominio de GitHub Pages)
4. Guarda

> ⚠️ Sin este paso, el botón de Google dará error de dominio no autorizado.

---

## Paso 3 — Publicar las reglas de seguridad

Las reglas garantizan que cada usuario solo acceda a sus propios datos.

### Opción A — Copiar y pegar en la consola (más fácil)

1. En Firebase Console → **Firestore Database** → pestaña **Rules**
2. Borra el contenido actual y pega esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Haz clic en **Publish** (Publicar)

### Opción B — Firebase CLI (requiere Node.js)

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## Paso 4 — Verificar que todo funciona

1. Abre AREX en el navegador
2. Debe aparecer la pantalla de login con el botón "Entrar con Google"
3. Inicia sesión con tu cuenta de Google
4. El sistema carga tu perfil y datos; si es la primera vez, aparece el onboarding
5. En Firestore Console → **Rules Playground**: prueba leer `/arex_data/arex_tareas` — debe dar **denegado** ✓

---

## Notas importantes

- Cada usuario tiene su propio espacio en Firestore bajo `users/{uid}/`
- Los datos se sincronizan entre dispositivos cuando el mismo usuario inicia sesión con Google
- Si cierras sesión y vuelves a entrar con el mismo Google, recuperas todos tus datos
- El archivo `config.js` con las credenciales **nunca** se sube al repositorio

## Usuarios de prueba / invitados

Si quieres que otras personas (Margaret, etc.) usen AREX:
1. Ellas entran con su propia cuenta de Google
2. Primera vez → aparece el onboarding: nombre del asistente, nombre de usuario, voz
3. Sus datos quedan completamente separados de los tuyos
4. Puedes personalizar el nombre del asistente (VIERNES para Margaret, etc.)
