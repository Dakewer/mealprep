# Deficcitto (MealPrep)

Aplicación web para planificar comidas: calcula tu TDEE y tus metas de macros, arma planes con ingredientes y genera la lista de compras. Proyecto académico en Angular 22 (componentes standalone, señales, formularios reactivos, Vitest).

**Equipo**

| Integrante (GitHub) | Bloque de trabajo |
|---|---|
| [@Dakewer](https://github.com/Dakewer) | Datos, errores y documentación |
| [@Frijol75](https://github.com/Frijol75) | Lista, búsqueda, paginación, detalle y estados de interfaz |
| [@LuisCacho-py](https://github.com/LuisCacho-py) | Formularios (alta, edición, validaciones, guard de salida) |

## Cómo correrlo

Requisitos: Node.js 22 (la versión con la que se probó) y npm.

```bash
npm ci            # instala dependencias (usa npm install solo si cambias package.json)
npm run api       # terminal 1: API simulada en http://localhost:3000
npm start         # terminal 2: app en http://localhost:4200
```

| Comando | Qué hace |
|---|---|
| `npm run api` | Levanta json-server en el puerto 3000. Crea `api/db.json` desde la semilla si no existe. |
| `npm run api:reset` | Restaura `api/db.json` desde `api/db.seed.json` (borra lo creado desde la app). |
| `npm start` | `ng serve` con el entorno de desarrollo. |
| `npm test` | Pruebas unitarias con Vitest (`npm test -- --watch=false` para una sola corrida). |
| `npm run build` | Build de producción en `dist/`. |

Para ver los estados de carga con calma, levanta la API con retraso:

```bash
npx json-server --watch api/db.json --port 3000 --delay 800
```

`api/db.json` está en `.gitignore`: json-server escribe en él con cada alta, edición o baja, y esos cambios de prueba no deben llegar a Git. Lo que se versiona es la semilla `api/db.seed.json`.

## 1. Backend elegido: API simulada con json-server

**Qué es.** [json-server](https://github.com/typicode/json-server) (versión fija `0.17.4`) expone un archivo JSON como una API REST completa. Los datos de ejemplo están en `api/db.seed.json` (12 planes y una colección `users` vacía).

**Por qué la elegimos.**

- Da un REST real (GET, POST, PUT, PATCH, DELETE) con búsqueda de texto, paginación y orden sin escribir un servidor, así que el equipo de tres puede trabajar en paralelo sobre la capa de datos, las listas y los formularios.
- Devuelve el total de registros en el encabezado `X-Total-Count` y lo expone por CORS, que es lo que necesita una paginación real en el cliente.
- Es reproducible: cualquiera la levanta con un comando y la restaura con otro.

**Limitaciones que asumimos.**

- No valida los datos: acepta cualquier cuerpo. Las validaciones viven en los formularios del frontend; con una API real, el servidor debe repetirlas.
- No tiene autenticación ni usuarios reales (esta entrega no la pide). Por eso los planes **no están separados por usuario**: todos los usuarios que usen la misma API ven los mismos planes.
- Los datos viven en un archivo local, y no se puede desplegar tal cual en un hosting estático.
- Solo los **planes** usan la API. El perfil del usuario y las listas de compras siguen guardándose en `localStorage`.

**Cómo se reemplaza por una API real.** El resto de la app no conoce json-server; solo conoce el contrato de la sección 2.

1. Implementar (o contratar, por ejemplo con un BaaS) una API que cumpla ese contrato y desplegarla.
2. Cambiar `apiBaseUrl` en `src/environments/environment.ts`. No hay más URLs en el código.
3. Si la API real usa otros nombres de parámetros de búsqueda, paginación u orden, se ajustan en un solo lugar: `toHttpParams()` y `list()` en `src/app/core/services/plans-api.service.ts`. Los componentes y `PlanService` no cambian.
4. Si devuelve los errores con el formato de la sección 2.3, el interceptor sigue funcionando igual. Si no, se ajusta `toApiError()` en `src/app/core/errors/api-error.ts`.

## 2. Contrato de la API

URL base: valor de `apiBaseUrl` del entorno (en desarrollo, `http://localhost:3000`). Todas las peticiones y respuestas son JSON.

### 2.1 Endpoints de planes

| Método y ruta | Qué hace | Respuestas |
|---|---|---|
| `GET /plans` | Lista planes. Admite filtros (abajo). | `200` con un arreglo. Con paginación, incluye `X-Total-Count`. |
| `GET /plans/:id` | Detalle de un plan. | `200` con el plan, `404` si no existe. |
| `POST /plans` | Crea un plan. No se envía `id`: lo asigna el servidor. | `201` con el plan creado. |
| `PUT /plans/:id` | Reemplaza el plan completo. | `200` con el plan, `404` si no existe. |
| `PATCH /plans/:id` | Cambia solo los campos enviados (ej. `{ "isFavorite": true }`). | `200` con el plan, `404` si no existe. |
| `DELETE /plans/:id` | Elimina el plan. | `200` con `{}`, `404` si no existe. |

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
HTTP/1.1 200 OK
X-Total-Count: 4
Access-Control-Expose-Headers: X-Total-Count, Link
```

Sin `_page` ni `_limit`, la API no envía `X-Total-Count`; el cliente usa entonces la cantidad de elementos recibidos como total.

### 2.2 Modelos de datos

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
  "tags": ["maintenance"]
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

El cuerpo de `POST` y `PUT` (`PlanPayload`) es el mismo objeto sin `id`.

### 2.3 Respuestas de error

Una API real debe responder los errores con este formato (el cliente lo entiende hoy):

```json
{
  "message": "El nombre es obligatorio.",
  "errors": { "name": ["Es obligatorio"] }
}
```

`message` se muestra al usuario solo en los estados `400`, `409` y `422`. `errors` (opcional) asocia mensajes a campos para pintarlos en un formulario.

El interceptor decide el mensaje según el código de estado, así que también funciona con respuestas sin cuerpo (como las de json-server):

| Estado | Cuándo | Mensaje que ve el usuario |
|---|---|---|
| `0` | Sin conexión o API apagada | No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo. |
| `400` / `422` | Datos inválidos | El mensaje del servidor, o: Los datos enviados no son válidos. |
| `401` | Sesión inválida | Tu sesión no es válida. Inicia sesión de nuevo. |
| `403` | Sin permiso | No tienes permiso para realizar esta acción. |
| `404` | No existe | No encontramos lo que buscabas. |
| `409` | Conflicto | El mensaje del servidor, o: Ya existe un registro con esos datos. |
| `5xx` | Fallo del servidor | El servidor tuvo un problema. Inténtalo de nuevo en unos minutos. |

Con json-server, un `404` responde con cuerpo `{}` y un JSON mal formado responde `400` con HTML; ambos casos quedan cubiertos por el mapeo por estado.

## 3. Arquitectura de la capa de datos

```
Componente  →  PlanService  →  PlansApiService  →  HttpClient  →  API
 (vista)      (estado con       (URLs, parámetros,    + interceptor
               señales)          mapeo a modelos)     de errores
```

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| URL base | `src/environments/*.ts` y `core/config/api-base-url.token.ts` | La URL sale del entorno. `environment.ts` es producción; `environment.development.ts` lo reemplaza en `ng serve` y `ng build --configuration development`. |
| `PlansApiService` | `core/services/plans-api.service.ts` | Única pieza que arma peticiones HTTP de planes. Los componentes nunca usan `HttpClient`. |
| `PlanService` | `core/services/plan.service.ts` | Estado de los planes en señales (`plans`, `plansStatus`, `plansError`, `plansLoading`) y operaciones de crear, editar, favorito y eliminar. |
| `ApiError` | `core/errors/api-error.ts` | Error tipado y normalizado: `status`, `message`, `fieldErrors`. |
| Interceptor | `core/interceptors/http-error.interceptor.ts` | **Único lugar** donde se manejan los errores HTTP: los convierte en `ApiError`, avisa al usuario con un toast y vuelve a lanzarlos. |

Cómo usar la capa de datos:

- **Escrituras** (`create`, `update`, `patch`, `remove`): si fallan, el interceptor ya mostró el aviso. Los métodos de `PlanService` no lanzan: devuelven `null` o `false`.
- **Lecturas** (`list`, `get`): no muestran aviso por defecto, porque la vista pinta su propio estado de error con botón de reintentar. Para forzar el aviso: `list(params, { notify: true })`.
- **Formularios**: quien llame directo a `PlansApiService` recibe un `ApiError` con `fieldErrors` para mostrar el error bajo cada campo.
- **Estados de carga**: `PlanService.plansStatus()` vale `idle`, `loading`, `loaded` o `error`.

## 4. Funcionalidad por bloque

### Datos, errores y documentación (@Dakewer)

Entornos y URL base, json-server con datos de ejemplo, `PlansApiService`, `ApiError`, interceptor global y este README. Ver secciones 1 a 3.

### Lista con búsqueda y paginación, detalle y estados de interfaz (@Frijol75)

_Pendiente. Aquí se documentarán la lista, la ruta de detalle, el modal de confirmación al eliminar y los componentes de carga, error y vacío._

### Formularios y validaciones (@LuisCacho-py)

_Pendiente. Aquí se documentarán el formulario de alta, el de edición con datos precargados, el validador personalizado, el guard de salida y el envío de login y registro._

## 5. Flujo de trabajo del equipo

- Nadie hace push a `main`: cada funcionalidad va en su propia rama y llega por Pull Request.
- Ramas: `feature/api-capa-datos` (Dakewer), `feature/lista-detalle` (Frijol75) y `feature/formularios` (LuisCacho-py). Para trabajo adicional, `feature/<tema>`.
- Cada PR lo revisa **otro** integrante, con esta rotación: los PRs de Dakewer los revisa Frijol75, los de Frijol75 los revisa LuisCacho-py y los de LuisCacho-py los revisa Dakewer. Se necesita al menos una aprobación para mergear.
- Los commits siguen el formato `tipo(ámbito): descripción` en español (`feat`, `fix`, `docs`, `test`, `chore`). Preferimos un commit por fase para que la revisión se pueda hacer commit por commit.
- Antes de abrir un PR: `npm test -- --watch=false` y `npm run build` deben pasar. Trae `main` a tu rama (`git merge origin/main`) para resolver conflictos antes de la revisión.
- Punto de conflicto frecuente: `app.routes.ts`. Los cambios en `app.models.ts` y `plan.service.ts` se coordinan con Dakewer.

## 6. Estructura del proyecto

```
api/                      API simulada: db.seed.json (versionado) y db.json (local, ignorado)
src/environments/         URL base de la API por entorno
src/app/core/
  config/                 token API_BASE_URL
  data/                   catálogo de ingredientes
  errors/                 ApiError
  guards/                 authGuard, publicGuard
  interceptors/           interceptor global de errores
  models/                 interfaces tipadas
  services/               Auth, Notification, Nutrition, Plan y PlansApi
src/app/features/         landing, páginas públicas, auth y dashboard
src/app/shared/           toast, barras de macros y directiva ripple
```

## Más información de Angular CLI

Este proyecto se generó con [Angular CLI](https://github.com/angular/angular-cli) 22.2.4. Referencia de comandos: [angular.dev/tools/cli](https://angular.dev/tools/cli).
