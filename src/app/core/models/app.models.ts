// ── User & Auth Models ────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials?: string;
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
  createdAt: string; // ISO string (se guarda en localStorage)
  isFavorite: boolean;
  tags: string[];
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
