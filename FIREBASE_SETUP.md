# AREX — Guía de configuración Firebase

## Paso 1 — Activar inicio de sesión anónimo

1. Abre la consola de Firebase: https://console.firebase.google.com
2. Selecciona tu proyecto AREX
3. En el menú izquierdo haz clic en **Authentication**
4. Ve a la pestaña **Sign-in method** (Métodos de acceso)
5. Busca **Anonymous** (Anónimo) en la lista
6. Haz clic en él y activa el interruptor que dice **Enable** (Habilitar)
7. Guarda con el botón **Save**

Listo. AREX ahora asignará automáticamente un ID único a cada dispositivo
sin necesidad de que el usuario cree una cuenta. El ID se conserva entre
sesiones en el mismo dispositivo.

---

## Paso 2 — Publicar las reglas de seguridad

Las reglas protegen que nadie acceda a los datos de otra persona.
Tienes dos opciones:

### Opción A — Copiar y pegar en la consola (más fácil)

1. En Firebase Console, menú izquierdo → **Firestore Database**
2. Ve a la pestaña **Rules** (Reglas)
3. Borra el contenido actual y pega esto exactamente:

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

4. Haz clic en **Publish** (Publicar)

### Opción B — Publicar con Firebase CLI (requiere Node.js)

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## Paso 3 — Verificar que quedó protegido

1. En Firestore Console, pestaña **Rules**
2. Usa el **Rules Playground** (botón en la esquina superior derecha)
3. Prueba con un documento en `/arex_data/arex_tareas` — debe dar **denegado**
4. Prueba con `/users/UID_CUALQUIERA/arex_data/arex_tareas` — debe dar **permitido** solo si el auth.uid coincide

---

## Notas importantes

- Los datos del dispositivo se guardan bajo `users/{uid}/` donde `{uid}` es el
  ID anónimo único generado por Firebase Auth para ese dispositivo
- Si el usuario borra las cookies/datos del navegador, se genera un nuevo uid
  y los datos anteriores quedan huérfanos en Firestore (no se pierden, solo
  no son accesibles desde ese dispositivo)
- El archivo `config.js` con las credenciales de Firebase **nunca** se sube al
  repositorio (está en `.gitignore`)
