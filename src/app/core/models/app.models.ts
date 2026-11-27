// ── User & Auth Models ────────────────────────────────────────
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  avatarInitials?: string;
  createdAt?: string;
}

/** Respuesta de `POST /auth/login` y `POST /auth/register`. */
export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  objective: 'deficit' | 'maintenance' | 'surplus';
  acceptTerms: boolean;
}

// ── Nutrition Models ──────────────────────────────────────────
export interface MacroGoals {
  protein: number;   // grams
  carbs: number;     // grams
  fat: number;       // grams
  calories: number;  // kcal
}

export interface NutritionPlan {
  id: string;
  name: string;
  description?: string;
  macroGoals: MacroGoals;
  items: PlanItem[];
  createdAt: string; // ISO 8601, lo define el cliente al crear el plan
  isFavorite: boolean;
  tags: string[];
  /** Id del usuario dueño del plan. Lo fija el servidor al crear; el cliente no lo envía. */
  ownerId?: string;
  /** Archivos adjuntos del plan (imágenes JPG/PNG/WEBP o PDF). */
  files?: PlanAttachment[];
  attachments?: PlanAttachment[];
}

/** Cuerpo que se envía a la API para crear (POST) o reemplazar (PUT) un plan. `id` y `ownerId` los asigna el servidor. */
export type PlanPayload = Omit<NutritionPlan, 'id' | 'ownerId'>;

/** Página de resultados de un listado paginado. */
export interface Page<T> {
  items: T[];
  /** Total de registros que cumplen el filtro (todas las páginas). */
  total: number;
  /** Página actual (empieza en 1). */
  page: number;
  /** Tamaño de página; `null` si el listado no se paginó. */
  limit: number | null;
}

export type IngredientCategory = 'Verduras' | 'Carnes' | 'Abarrotes' | 'Lácteos';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: string;
  gramsPer100: number;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  isChecked?: boolean;
}

export interface ShoppingItem {
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  quantity: number;
  unit: string;
  isChecked: boolean;
}

export interface ShoppingList {
  id: string;
  planId: string;
  planName: string;
  items: ShoppingItem[];
  generatedAt: string; // ISO string
}

// ── Perfil y cálculo de TDEE ─────────────────────────────────
export type Sex = 'male' | 'female';
export type Objective = RegisterData['objective'];
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface UserProfile {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activity: ActivityLevel;
  objective: Objective;
}

// ── Plan: ingredientes con su cantidad ───────────────────────
export interface PlanItem {
  ingredientId: string;
  grams: number;
}

export interface PlanAttachment {
  id: string;
  planId: string;
  name: string;
  mimeType: string;
  size: number;        // bytes
  url: string;
  createdAt: string;   // ISO 8601
}

// ── Eventos en tiempo real (WebSocket) ───────────────────────
/** Estado del canal WebSocket. Mientras se abre o se reintenta, vale `'reconnecting'`. */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/** Nombre del evento → carga útil que envía el servidor. */
export interface RealtimeEventMap {
  'plan:created': NutritionPlan;
  'plan:updated': NutritionPlan;
  'plan:deleted': { id: string };
  'plan:file-added': PlanAttachment;
  'plan:file-removed': PlanAttachment;
}

export type RealtimeEventName = keyof RealtimeEventMap;

/** Mensaje del canal: `{ event, data, actorId, at }`. `actorId` es quien provocó el cambio. */
export type RealtimeMessage = {
  [E in RealtimeEventName]: {
    event: E;
    data: RealtimeEventMap[E];
    actorId: string | null;
    at: string; // ISO 8601
  };
}[RealtimeEventName];
