# Deficcitto (MealPrep)

Aplicación web para planificar comidas: calcula tu TDEE y tus metas de macros, arma planes con ingredientes y genera la lista de compras. Proyecto académico en Angular 22 (componentes standalone, señales, formularios reactivos, Vitest).

**Equipo**

| Integrante (GitHub) | Bloque de trabajo |
|---|---|
| [@Dakewer](https://github.com/Dakewer) | Datos, errores, documentación, backend y autenticación |
| [@Frijol75](https://github.com/Frijol75) | Lista, búsqueda, paginación, detalle y estados de interfaz |
| [@LuisCacho-py](https://github.com/LuisCacho-py) | Formularios (alta, edición, login/registro), directivas de permisos (`*appHasRole`, `*appCanManage`) y manejo de 403 |

## Cómo correrlo

Requisitos: Node.js 22 (la versión con la que se probó) y npm.

```bash
npm ci               # instala dependencias (usa npm install solo si cambias package.json)
cp .env.example .env # crea el archivo de variables de entorno y cambia JWT_SECRET
npm run api          # terminal 1: API con autenticación en http://localhost:3000
npm start            # terminal 2: app en http://localhost:4200
```

> En Windows (PowerShell) el `cp` es `Copy-Item .env.example .env`. Genera un `JWT_SECRET` propio con:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

| Comando | Qué hace |
|---|---|
| `npm run api` | Levanta la API con autenticación (Express + json-server montado para `/plans`) en el puerto 3000. Crea `api/db.json` desde la semilla si no existe. |
| `npm run api:reset` | Restaura `api/db.json` desde `api/db.seed.json` (borra planes y cuentas creados desde la app). **Debe ejecutarse con la API parada.** |
| `npm start` | `ng serve` con el entorno de desarrollo. |
| `npm test` | Pruebas unitarias con Vitest (`npm test -- --watch=false` para una sola corrida). |
| `npm run build` | Build de producción en `dist/`. |

Los retrasos artificiales para ver los estados de carga se configuran con la variable opcional `API_DELAY_MS` (por ejemplo `API_DELAY_MS=800`) en el `.env`; no están en `.env.example` para no afectar al uso normal.

`api/db.json` está en `.gitignore`: la API escribe en él con cada alta, edición o baja, y esos cambios de prueba no deben llegar a Git. Lo que se versiona es la semilla `api/db.seed.json`.

**Cuentas de prueba** (definidas en la semilla, con la contraseña en hash bcrypt):

| Correo | Contraseña | Rol | Uso |
|---|---|---|---|
| `admin@deficcitto.com` | `Admin1234` | `admin` | Ve todos los planes de todos los usuarios y la lista de usuarios en `/admin/usuarios`. |
| `carlos@deficcitto.com` | `Carlos1234` | `user` | Dueño de los 12 planes de ejemplo; solo ve sus propios planes. |

## 1. Backend elegido: API simulada con json-server más una capa de autenticación

**Qué es.** La capa de datos usa [json-server](https://github.com/typicode/json-server) (versión fija `0.17.4`), que expone un archivo JSON como API REST completa. Sobre él hay un servidor **Express 4** propio (`api/server.cjs`) que añade:

- **Autenticación JWT**: `POST /auth/register`, `POST /auth/login` y `GET /auth/me`.
- **Contraseñas con bcrypt** (`bcryptjs`, el mismo algoritmo que `bcrypt` pero sin compilar código nativo, que da problemas en Windows).
- **Autorización por rol y por dueño** en `/plans` (ver sección 4).
- **Restricción de escritura sobre `/users`**: solo se permite `GET /users` para administradores; el resto de métodos y `/db` devuelven 404.

json-server sigue atendiendo únicamente `/plans` y se monta como middleware. Los datos de ejemplo están en `api/db.seed.json` (12 planes y 2 usuarios de prueba).

**Por qué esta combinación.**

- Da un REST real (GET, POST, PUT, PATCH, DELETE) con búsqueda de texto, paginación y orden sin reescribir un backend completo, y a la vez permite demostrar autenticación real con JWT y bcrypt, que es lo que pide la rúbrica.
- Devuelve el total de registros en el encabezado `X-Total-Count` y lo expone por CORS, que es lo que necesita una paginación real en el cliente.
- Es reproducible: cualquiera la levanta con un comando y la restaura con otro.

**Limitaciones que asumimos.**

- No valida los datos de los planes: acepta cualquier cuerpo. Las validaciones viven en los formularios del frontend; con una API real, el servidor debe repetirlas. La autenticación sí valida el formato de correo, nombre y contraseña.
- Los datos viven en un archivo local, y no se puede desplegar tal cual en un hosting estático.
- Solo los **planes** y la **autenticación** usan la API. El perfil del usuario y las listas de compras siguen guardándose en `localStorage`, por usuario.
- No hay refresh token ni revocación de tokens: cuando un JWT expira, hay que volver a iniciar sesión. Ver limitaciones en la sección 4.7.

**Cómo se reemplaza por una API real.** El resto de la app no conoce json-server; solo conoce el contrato de la sección 2.

1. Implementar (o contratar, por ejemplo con un BaaS) una API que cumpla ese contrato y desplegarla.
2. Cambiar `apiBaseUrl` en `src/environments/environment.ts`. No hay más URLs en el código.
3. Si la API real usa otros nombres de parámetros de búsqueda, paginación u orden, se ajustan en un solo lugar: `toHttpParams()` y `list()` en `src/app/core/services/plans-api.service.ts`. Los componentes y `PlanService` no cambian.
4. Si devuelve los errores con el formato de la sección 2.3, el interceptor sigue funcionando igual. Si no, se ajusta `toApiError()` en `src/app/core/errors/api-error.ts`.

## 2. Contrato de la API

URL base: valor de `apiBaseUrl` del entorno (en desarrollo, `http://localhost:3000`). Todas las peticiones y respuestas son JSON.

### 2.1 Endpoints de autenticación

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `POST /auth/register` | Crea la cuenta con rol `user`. El servidor fija `role`, `id`, `createdAt` y `avatarInitials`. | `201` con `{ token, user }`; `400` si los datos no son válidos; `409` si el correo ya existe. |
| `POST /auth/login` | Valida correo y contraseña. Tarda lo mismo con un correo inexistente (se compara contra un hash ficticio) para no filtrar cuentas. | `200` con `{ token, user }`; `400` si faltan datos; `401` si las credenciales son incorrectas. |
| `GET /auth/me` | Devuelve el usuario del token. | `200` con `user`; `401` si falta el token, es inválido o expiró. |

`AuthResponse`:

```json
{
  "token": "<jwt>",
  "user": { "id": "usr-002", "name": "Carlos Fitness", "email": "carlos@deficcitto.com", "role": "user", "avatarInitials": "CF", "createdAt": "2026-10-15T10:30:00.000Z" }
}
```

El `user` **nunca** incluye `passwordHash`: el servidor lo elimina antes de responder.

### 2.2 Endpoints de planes

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /plans` | Lista planes. Un `user` solo ve los suyos; un `admin` ve todos. | `200` con un arreglo. Con paginación, incluye `X-Total-Count`. |
| `GET /plans/:id` | Detalle de un plan. | `200` con el plan; `403` si pertenece a otro usuario y no eres admin; `404` si no existe. |
| `POST /plans` | Crea un plan. El servidor fija `ownerId` desde el token (el cliente no lo envía). | `201` con el plan creado. |
| `PUT /plans/:id` | Reemplaza el plan completo. No puede cambiar `ownerId`. | `200` con el plan; `403` si no es tuyo (salvo admin); `404` si no existe. |
| `PATCH /plans/:id` | Cambia solo los campos enviados (ej. `{ "isFavorite": true }`). No puede cambiar `ownerId`. | `200` con el plan; `403` si no es tuyo (salvo admin); `404` si no existe. |
| `DELETE /plans/:id` | Elimina el plan. | `200` con `{}`; `403` si no es tuyo (salvo admin); `404` si no existe. |

Todos los endpoints de `/plans` exigen un `Authorization: Bearer <token>` válido: sin token, responden `401`.

Parámetros de `GET /plans` (todos opcionales):

| Parámetro | Ejemplo | Significado |
|---|---|---|
| `q` | `q=pollo` | Búsqueda de texto. En json-server revisa todos los campos del plan: nombre, descripción, etiquetas e ingredientes. |
| `_page` y `_limit` | `_page=2&_limit=5` | Paginación (la página empieza en 1). |
| `_sort` y `_order` | `_sort=createdAt&_order=desc` | Orden. `_order` es `asc` o `desc`. |
| `isFavorite` | `isFavorite=true` | Solo favoritos. |

Ejemplo de lista paginada:

```http
GET /plans?q=pollo&_page=1&_limit=3
Authorization: Bearer <token>
HTTP/1.1 200 OK
X-Total-Count: 4
Access-Control-Expose-Headers: X-Total-Count, Link
```

Sin `_page` ni `_limit`, la API no envía `X-Total-Count`; el cliente usa entonces la cantidad de elementos recibidos como total.

### 2.3 Modelos de datos

`NutritionPlan` (definido en `src/app/core/models/app.models.ts`):

```json
{
  "id": "plan-001",
  "name": "Desayuno proteico",
  "description": "Avena con yogur y plátano para empezar el día.",
  "macroGoals": { "calories": 411, "protein": 26, "carbs": 68, "fat": 5 },
  "items": [
    { "ingredientId": "avena", "grams": 60 },
    { "ingredientId": "yogur", "grams": 150 }
  ],
  "createdAt": "2026-10-11T12:00:00.000Z",
  "isFavorite": true,
  "tags": ["maintenance"],
  "ownerId": "usr-002"
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | Lo asigna el servidor. json-server puede devolver ids numéricos o de texto; el cliente siempre los convierte a texto. |
| `name` | string | Obligatorio. |
| `description` | string, opcional | |
| `macroGoals` | objeto | Calorías (kcal), proteína, carbohidratos y grasa (g) del plan, calculados por el cliente. |
| `items` | arreglo | Cada elemento es `{ ingredientId: string, grams: number }`. Los ids salen del catálogo de ingredientes del cliente (`src/app/core/data/ingredients.data.ts`). |
| `createdAt` | string ISO 8601 | Lo define el cliente al crear el plan. |
| `isFavorite` | boolean | |
| `tags` | arreglo de strings | Hoy guarda el objetivo del usuario (`deficit`, `maintenance` o `surplus`). |
| `ownerId` | string, opcional | Id del usuario dueño del plan. Lo fija el servidor al crear; el cliente **no lo envía** y no puede cambiarlo. Los planes de la semilla pertenecen a `usr-002`. |

El cuerpo de `POST` y `PUT` (`PlanPayload`) es el mismo objeto sin `id` ni `ownerId`.

`User`:

```json
{
  "id": "usr-002",
  "name": "Carlos Fitness",
  "email": "carlos@deficcitto.com",
  "role": "user",
  "avatarInitials": "CF",
  "createdAt": "2026-10-15T10:30:00.000Z"
}
```

`role` es `'admin'` o `'user'`. `passwordHash` existe solo en el servidor.

### 2.4 Respuestas de error

Los errores se devuelven con este formato:

```json
{
  "message": "El nombre es obligatorio.",
  "errors": { "name": ["Es obligatorio"] }
}
```

`message` se muestra al usuario en `400`, `409` y `422` (o en el formulario de login/registro para el `401`, que muestra un mensaje genérico de credenciales). `errors` (opcional) asocia mensajes a campos para pintarlos en un formulario.

El interceptor decide el mensaje según el código de estado, así que también funciona con respuestas sin cuerpo:

| Estado | Cuándo | Comportamiento |
|---|---|---|
| `0` | Sin conexión o API apagada | Aviso global: no se pudo conectar con el servidor. |
| `400` / `422` | Datos inválidos | Aviso con el mensaje del servidor, o “Los datos enviados no son válidos.”. |
| `401` | Sesión inválida | Si había sesión abierta, cierra la sesión, avisa “Tu sesión expiró” y redirige a `/auth/login?returnUrl=<ruta>`. Si no había sesión (login fallido), no muestra toast global: el formulario pinta el mensaje. |
| `403` | Sin permiso | Aviso “Acceso denegado” con el mensaje del servidor. **No** cierra la sesión. |
| `404` | No existe | Aviso “No encontramos lo que buscabas.”. |
| `409` | Conflicto | Aviso con el mensaje del servidor, o “Ya existe un registro con esos datos.”. |
| `5xx` | Fallo del servidor | Aviso “El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.”. |

## 3. Arquitectura de la capa de datos

```
Componente  →  PlanService  →  PlansApiService  →  HttpClient  →  API
 (vista)      (estado con       (URLs, parámetros,    + interceptores
               señales)          mapeo a modelos)     (auth + errores)
```

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| URL base | `src/environments/*.ts` y `core/config/api-base-url.token.ts` | La URL sale del entorno. `environment.ts` es producción; `environment.development.ts` lo reemplaza en `ng serve` y `ng build --configuration development`. |
| `PlansApiService` | `core/services/plans-api.service.ts` | Única pieza que arma peticiones HTTP de planes. Los componentes nunca usan `HttpClient`. |
| `PlanService` | `core/services/plan.service.ts` | Estado de los planes en señales (`plans`, `plansStatus`, `plansError`, `plansLoading`) y operaciones de crear, editar, favorito y eliminar. Al cambiar de usuario, vacía los planes del anterior y recarga. |
| `AuthService` | `core/services/auth.service.ts` | Estado de sesión en señales (`token`, `currentUser`, `status`, `error`, `logoutReason`, `isAuthenticated`). Login, registro, logout, `checkSession()` y `restoreSession()`. |
| `ApiError` | `core/errors/api-error.ts` | Error tipado y normalizado: `status`, `message`, `fieldErrors`. |
| `authInterceptor` | `core/interceptors/auth.interceptor.ts` | Añade `Authorization: Bearer <token>` a las peticiones hacia la API. No toca peticiones externas ni las que ya traen `Authorization`. |
| `httpErrorInterceptor` | `core/interceptors/http-error.interceptor.ts` | **Único lugar** donde se manejan los errores HTTP: los convierte en `ApiError`, gestiona 401 (cierra sesión y redirige) y 403, y avisa al usuario con un toast. Vuelve a lanzarlos. |

Cómo usar la capa de datos:

- **Escrituras** (`create`, `update`, `patch`, `remove`): si fallan, el interceptor ya mostró el aviso. Los métodos de `PlanService` no lanzan: devuelven `null` o `false`.
- **Lecturas** (`list`, `get`): no muestran aviso por defecto, porque la vista pinta su propio estado de error con botón de reintentar. Para forzar el aviso: `list(params, { notify: true })`.
- **Formularios**: quien llame directo a `PlansApiService` recibe un `ApiError` con `fieldErrors` para mostrar el error bajo cada campo.
- **Estados de carga**: `PlanService.plansStatus()` vale `idle`, `loading`, `loaded` o `error`.

## 4. Autenticación y autorización

### 4.1 Fuente de autenticación y justificación

La autenticación es **propia**, implementada en `api/` con Express 4, `bcryptjs` y `jsonwebtoken`. No hay proveedor externo (Auth0, Firebase, etc.) por dos motivos: el proyecto es académico y no debe depender de una cuenta de terceros para correr, y el objetivo es demostrar el flujo completo (hash, JWT, roles, regla de dueño) sin ocultarlo tras un SDK.

`json-server` por sí solo no tiene autenticación. En vez de sustituirlo, se monta como middleware para `/plans` y se intercepta con `requireAuth` + `plansAccess(db)` (`api/middleware.cjs`). El resto de rutas (`/auth`, `/users`, `/db`) las gestiona Express, no json-server.

### 4.2 Cómo funciona el JWT

El token se firma con **HS256** y lleva tres claims:

```json
{ "sub": "usr-002", "role": "user", "iat": 1762000000, "exp": 1762003600 }
```

- `sub`: id del usuario.
- `role`: rol (`admin` o `user`). **Nunca** viene del cliente; lo pone el servidor al firmar.
- `exp`: vencimiento. Por defecto **1 hora** (`JWT_EXPIRES_IN=1h` en `.env`).

El servidor lo verifica en `requireAuth` (`api/middleware.cjs`), que devuelve 401 si falta, no es válido o expiró. El cliente **no verifica la firma** (no puede, no tiene el secreto): solo decodifica el cuerpo para leer `sub` y `exp` y saber si hay que cerrar la sesión antes de tiempo. Eso se hace en `checkSession()` de `AuthService`.

El secreto está en `JWT_SECRET` (`.env`, no versionado) y debe tener al menos 16 caracteres. El servidor no arranca si falta: un secreto vacío permitiría firmar tokens a cualquiera.

### 4.3 Dónde y cómo se guarda el token en el cliente

- `localStorage` con la clave `deficcitto_token`. El token es la **fuente de verdad**.
- `localStorage` con la clave `deficcitto_user`: copia del usuario para pintar la interfaz rápido (nombre, iniciales) sin esperar a `/auth/me`. Al arrancar, si hay token, `restoreSession()` pide `GET /auth/me` y actualiza al usuario.
- La casilla “Recordarme” **no** cambia dónde se guarda: en esta versión la sesión siempre va a `localStorage`. Se quitó del formulario para no prometer algo que no hace.
- Al cerrar sesión (`logout()`), se limpian ambas claves y todas las señales del `AuthService`. También se limpian restos de `sessionStorage` de versiones anteriores de la demo.
- El `AuthService` **no hace HTTP en su constructor**: los interceptores lo inyectan, y una petición HTTP desde ahí sería circular. El constructor solo lee `localStorage` de forma síncrona. La petición a `/auth/me` se lanza después, vía `provideAppInitializer`, sin bloquear el arranque y sin lanzar.

### 4.4 Variables de entorno

`.env.example` es la plantilla versionada; `.env` es tu copia local (ignorada por Git).

| Variable | Obligatoria | Ejemplo | Para qué |
|---|---|---|---|
| `JWT_SECRET` | Sí (mínimo 16 caracteres) | `154d44034bc4ce7a144c39d895ab228380a1da04302857f05935e1aebb93ad79` | Secreto con el que se firman los JWT. Cada desarrollador debe tener el suyo. |
| `JWT_EXPIRES_IN` | No (`1h` por defecto) | `1h` | Duración del token. Acepta `1h`, `30m`, `7d` o un número en segundos. |
| `PORT` | No (`3000` por defecto) | `3000` | Puerto del servidor Express. |
| `CORS_ORIGIN` | No (`http://localhost:4200`) | `http://localhost:4200` | Orígenes permitidos, separados por coma. |
| `API_DELAY_MS` | No (`0` por defecto) | `800` | Retraso artificial para ver los estados de carga. |

### 4.5 Roles y permisos

| Acción / vista | Invitado | user | admin |
|---|---|---|---|
| Landing, características, testimonios | ✅ | ✅ | ✅ |
| Login / registro | ✅ | ❌ redirige a /dashboard | ❌ redirige a /dashboard |
| Dashboard, calculadora, listas de compras | ❌ → login | ✅ | ✅ |
| Ver planes | ❌ | Solo los suyos | Todos |
| Crear plan | ❌ | ✅ | ✅ |
| Editar / eliminar plan | ❌ | Solo los suyos (403 si no) | Todos |
| /admin/usuarios | ❌ → login | ❌ vista 403 | ✅ |

#### Regla de dueño en `/plans`

- **`user`**: ve solo sus planes. `GET /plans` filtra por `ownerId` en el servidor (no en el cliente). Un plan ajeno responde 403. Al crear, el servidor pone `ownerId` desde el token. Ni `PUT` ni `PATCH` pueden cambiar `ownerId`.
- **`admin`**: ve todos los planes. Puede editar o borrar cualquier plan, y es el único que puede llamar a `GET /users` (lo usa la vista `/admin/usuarios`).
- **Planes sin dueño** (datos viejos de la semilla anterior): solo los ve el admin.
- `GET /users`, `POST/PUT/PATCH/DELETE /users` y `/db` están cerrados para clientes. `GET /users` responde 403 para un `user`; el resto devuelve 404.

La regla se implementa en `plansAccess(db)` (`api/middleware.cjs`), que se ejecuta antes de json-server y solo para `/plans`.

#### Directivas estructurales `*appHasRole` y `*appCanManage`

Definidas en `src/app/shared/directives/has-role.directive.ts` (standalone):

- **`*appHasRole`**: muestra u oculta una plantilla según el rol de la sesión actual (`authService.role()`). Acepta un rol (`'admin'`), un arreglo de roles (`['admin', 'user']`) y plantilla `else`.
- **`*appCanManage`**: muestra u oculta una plantilla aplicando la regla de dueño (`authService.canManage(plan)`): permite la vista si el usuario es `admin` o si `plan.ownerId === currentUser().id`. También acepta `else`.

```html
<!-- Solo visible para administradores -->
<a *appHasRole="'admin'" routerLink="/admin/usuarios">Usuarios</a>

<!-- Con plantilla alternativa cuando no se cumple el rol -->
<section *appHasRole="'admin'; else sinPermiso">Panel de administración</section>
<ng-template #sinPermiso><p>No tienes permisos de administrador.</p></ng-template>

<!-- Botones de edición y borrado según la regla de dueño o rol admin -->
<a *appCanManage="plan" [routerLink]="['/dashboard/planes', plan.id, 'editar']">Editar</a>
<button *appCanManage="plan" type="button" (click)="requestDelete(plan)">Eliminar</button>
```

**Por qué evitan repetir `@if` en cada componente:** ambas directivas usan un `effect()` reactivo sobre las señales de `AuthService` (`role()` y `currentUser()`) junto con `ViewContainerRef` + `TemplateRef`. De este modo, toda la lógica de autorización en la interfaz queda centralizada en `AuthService` y en las directivas, sin esparcir comparaciones manuales como `@if (user.role === 'admin')` ni duplicar vistas cuando cambia la sesión (login/logout).

### 4.6 Flujo de sesión en el cliente

1. **Login / registro**: `AuthService` hace POST y guarda `token` + `user`. El formulario muestra `authService.error()` si falla; si funciona, navega a `returnUrl` (solo rutas internas: empieza por `/` y no por `//`) o a `/dashboard`.
2. **Recarga de página**: el constructor del `AuthService` lee el token, comprueba `exp` y, si es válido, `restoreSession()` pide `GET /auth/me`.
3. **Navegación a una ruta privada**: `authGuard` llama a `checkSession()`. Si falta o expiró, redirige a `/auth/login?returnUrl=<state.url>`. Si expiró, además avisa “Tu sesión expiró”.
4. **Navegación a una ruta pública de auth**: `publicGuard` comprueba lo mismo, pero al revés: si hay sesión válida, manda a `/dashboard`.
5. **401 de la API**: el `httpErrorInterceptor` cierra la sesión (con `logoutReason = 'expired'`), avisa y redirige a `/auth/login?returnUrl=...`. Varios 401 simultáneos solo disparan una redirección y un aviso.
6. **403 de la API**: el `httpErrorInterceptor` muestra un toast “Acceso denegado” y **no** cierra la sesión.
7. **Logout manual**: limpia todo y deja `status` en `idle`.

### 4.7 Limitaciones conocidas

- **Sin refresh token**: cuando el JWT vence, hay que volver a iniciar sesión. Para una app real, el servidor emitiría un refresh token de corta vida y un endpoint de renovación.
- **Sin revocación**: un token robado sirve hasta que expire. En producción, una lista de revocación o tokens de vida más corta.
- **Sin límite de intentos**: no hay rate limit en `/auth/login`. Un atacante podría probar contraseñas a la velocidad de la red. En producción, límite por IP y por cuenta.
- **Un solo secreto (`JWT_SECRET`)**: rotar el secreto invalida todos los tokens vigentes. Es aceptable para el alcance académico.
- **`localStorage` es vulnerable a XSS**: si un script malicioso se ejecuta en la página, puede leer el token. La mitigación real es una CSP estricta y una cookie `HttpOnly` + `SameSite`, que se descartó por simplicidad.
- **Sin HTTPS en desarrollo**: `localhost` está exento por los navegadores, pero en producción el sitio debe servirse siempre por HTTPS.
- **Cierre de sesión sin avisar al servidor**: el logout es solo del cliente; el token sigue siendo válido en el servidor hasta que expira.

## 5. Funcionalidad por bloque

### Datos, errores, documentación, backend y autenticación (@Dakewer)

Entornos y URL base, json-server con datos de ejemplo, `PlansApiService`, `ApiError`, interceptor global, servidor Express con JWT y bcrypt, regla de dueño, `AuthService` con señales, `authInterceptor` y este README. Ver secciones 1 a 4.

### Lista con búsqueda y paginación, detalle y estados de interfaz (@Frijol75)

_Pendiente. Aquí se documentarán la lista, la ruta de detalle, el modal de confirmación al eliminar y los componentes de carga, error y vacío._

### Formularios y validaciones (@LuisCacho-py)

- **Validadores personalizados y guard de salida (`C1`)**:
  - `src/app/core/validators/plan.validators.ts`: `notBlankValidator()`, `minIngredientsValidator(min)`, `ingredientGramsRangeValidator(min, max)` y `uniquePlanNameValidator()` (evita nombres duplicados ignorando mayúsculas/espacios y permitiendo conservar el nombre original al editar).
  - `src/app/core/guards/unsaved-changes.guard.ts`: `unsavedChangesGuard` (`CanDeactivateFn<HasUnsavedChanges>`) que impide perder cambios sin guardar al salir de `/dashboard` o `/dashboard/planes/:id/editar`.
- **Formulario reactivo de alta y edición de planes (`C2` y `C3`)**:
  - `PlanBuilderComponent` (`src/app/features/dashboard/components/plan-builder/`) y `PlanEditComponent` (`/dashboard/planes/:id/editar`): `FormGroup` + `FormArray` tipados, mensajes de error por campo, botón deshabilitado con spinner mientras guarda y precarga del plan existente en modo edición.
- **Formularios de login y registro (`Entrega 3`)**:
  - Validaciones reactivas por campo debajo de cada input cuando el control fue tocado (`touched`) o tras enviar el formulario (`submitted`): correo requerido y con formato válido, contraseña requerida con longitud mínima, nombre con mínimo de caracteres, validador de grupo `passwordsMatch` para confirmar contraseña y casilla obligatoria `acceptTerms`.
  - Estado de carga (`authService.isLoading()`): botón deshabilitado sin doble envío con spinner y texto `"Ingresando…"` (login) / `"Creando cuenta…"` (registro).
  - Mensajes generales claros: `401` → `"Correo o contraseña incorrectos."`; `409` en registro → `"Ese correo ya está registrado."`.
  - Aviso de sesión expirada arriba del login (`logoutReason() === 'expired'` o `?expired` en la URL): `"Tu sesión expiró. Inicia sesión de nuevo."`.
  - Conservación de `returnUrl` al navegar de login a `"¿No tienes cuenta? Regístrate gratis"` y redirección automática a `returnUrl` tras completar el registro.
- **Manejo del `403 Forbidden` en el CRUD de planes (`Entrega 3`)**:
  - Distinguido mediante `ApiError.status === 403` (`src/app/core/errors/api-error.ts`) sin duplicar el toast global del interceptor:
  - **Eliminar (`DELETE`)**: cierra el modal de confirmación, quita el estado de carga, revierte el borrado optimista para que el plan permanezca en la lista y conserva la página actual.
  - **Editar (`PUT` en `plan-edit`)**: sale del estado de envío, muestra el mensaje en línea `"No tienes permiso para editar este plan"`, desactiva el guard `canDeactivate` de cambios sin guardar y ofrece un botón para volver al detalle.
  - **Favorito (`PATCH`)**: revierte la estrella a su estado anterior.
  - **Detalle (`GET /dashboard/planes/:id` de otro usuario)**: muestra `<app-error-state>` con `"No tienes acceso a este plan"` en lugar de quedar cargando indefinidamente.

## 6. Flujo de trabajo del equipo

- Nadie hace push a `main`: cada funcionalidad va en su propia rama y llega por Pull Request.
- Ramas: `feature/auth-api-capa` (Dakewer, esta entrega), `feature/lista-detalle` (Frijol75) y `feature/formularios` (LuisCacho-py). Para trabajo adicional, `feature/<tema>`.
- Cada PR lo revisa **otro** integrante, con esta rotación: los PRs de Dakewer los revisa Frijol75, los de Frijol75 los revisa LuisCacho-py y los de LuisCacho-py los revisa Dakewer. Se necesita al menos una aprobación para mergear.
- Los commits siguen el formato `tipo(ámbito): descripción` en español (`feat`, `fix`, `docs`, `test`, `chore`). Preferimos un commit por fase para que la revisión se pueda hacer commit por commit.
- Antes de abrir un PR: `npm test -- --watch=false` y `npm run build` deben pasar (59 pruebas en esta entrega). Trae `main` a tu rama (`git merge origin/main`) para resolver conflictos antes de la revisión.
- Punto de conflicto frecuente: `app.routes.ts`. Los cambios en `app.models.ts`, `auth.service.ts`, `plan.service.ts` y `dashboard.component.ts` se coordinan con Dakewer.
- **Orden de fusión**: los PR #6 (`feature/formularios`) y #7 (`feature/guards-vistas`) chocan entre sí en `app.routes.ts`, `auth.service.ts` y `dashboard.component.ts`. Este PR (`feature/auth-api-capa`) sale de `main` y no depende de ellos, pero reescribe `auth.service.ts`, así que debe fusionarse **antes** que #6 y #7 para que la resolución de conflictos sea en un solo sentido.

## 7. Estructura del proyecto

```
api/                      Servidor Express + json-server: db.seed.json (versionado), db.json (local, ignorado),
                          config.cjs, auth.cjs, middleware.cjs, server.cjs, prepare-db.cjs
src/environments/         URL base de la API por entorno
src/app/core/
  config/                 token API_BASE_URL
  data/                   catálogo de ingredientes
  errors/                 ApiError y toApiError
  guards/                 authGuard, publicGuard
  interceptors/           authInterceptor y httpErrorInterceptor
  models/                 interfaces tipadas
  services/               Auth, Notification, Nutrition, Plan y PlansApi
  testing/                fake-jwt.ts (helper de pruebas)
src/app/features/         landing, páginas públicas, auth y dashboard
src/app/shared/           toast, barras de macros y directiva ripple
```

## Más información de Angular CLI

Este proyecto se generó con [Angular CLI](https://github.com/angular/angular-cli) 22.2.4. Referencia de comandos: [angular.dev/tools/cli](https://angular.dev/tools/cli).
