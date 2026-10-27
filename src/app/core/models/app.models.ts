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
  createdAt: Date;
  isFavorite: boolean;
  tags: string[];
}

export interface Ingredient {
  id: string;
  name: string;
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
  quantity: number;
  unit: string;
  isChecked: boolean;
}

export interface ShoppingList {
  id: string;
  planId: string;
  planName: string;
  items: ShoppingItem[];
  generatedAt: Date;
}
