import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { INGREDIENT_CATALOG } from '../data/ingredients.data';
import {
  Ingredient, NutritionPlan, PlanItem, ShoppingItem, ShoppingList, UserProfile,
} from '../models/app.models';
import { AuthService } from './auth.service';
import { NutritionService } from './nutrition.service';

export const DEFAULT_PROFILE: UserProfile = {
  sex: 'male', age: 25, weightKg: 70, heightCm: 170,
  activity: 'moderate', objective: 'maintenance',
};

/** Estado del dashboard: perfil, planes y listas de compras (guardado por usuario en localStorage). */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private auth      = inject(AuthService);
  private nutrition = inject(NutritionService);

  /** Catálogo disponible para armar planes. */
  readonly ingredients: Ingredient[] = INGREDIENT_CATALOG;

  // ── Estado ────────────────────────────────────────────────
  private _profile = signal<UserProfile>(DEFAULT_PROFILE);
  private _plans   = signal<NutritionPlan[]>([]);
  private _lists   = signal<ShoppingList[]>([]);

  readonly profile = this._profile.asReadonly();
  readonly plans   = this._plans.asReadonly();
  readonly lists   = this._lists.asReadonly();

  // ── Derivados ─────────────────────────────────────────────
  readonly tdee = computed(() => this.nutrition.calculateTdee(this._profile()));
  readonly goals = computed(() => this.nutrition.calculateMacroGoals(this._profile()));
  readonly favoritesCount = computed(() => this._plans().filter(p => p.isFavorite).length);

  constructor() {
    // Carga inicial síncrona: los componentes que se construyen enseguida ya ven los datos guardados.
    this.load(this.auth.currentUser()?.id);

    // Recarga los datos cuando cambia el usuario (login / logout).
    effect(() => this.load(this.auth.currentUser()?.id));
  }

  private load(userId: string | undefined): void {
    this._profile.set(this.read<UserProfile>(userId, 'profile', DEFAULT_PROFILE));
    this._plans.set(this.read<NutritionPlan[]>(userId, 'plans', []));
    this._lists.set(this.read<ShoppingList[]>(userId, 'lists', []));
  }

  // ── Perfil ────────────────────────────────────────────────
  updateProfile(profile: UserProfile): void {
    this._profile.set(profile);
    this.write('profile', profile);
  }

  // ── Planes ────────────────────────────────────────────────
  savePlan(name: string, items: PlanItem[], description = ''): NutritionPlan {
    const plan: NutritionPlan = {
      id: `plan-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      macroGoals: this.nutrition.calculateTotals(items, this.ingredients),
      items,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      tags: [this._profile().objective],
    };
    this._plans.update(list => [plan, ...list]);
    this.write('plans', this._plans());
    return plan;
  }

  deletePlan(id: string): void {
    this._plans.update(list => list.filter(p => p.id !== id));
    this.write('plans', this._plans());
  }

  toggleFavorite(id: string): void {
    this._plans.update(list =>
      list.map(p => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)),
    );
    this.write('plans', this._plans());
  }

  // ── Listas de compras ─────────────────────────────────────
  generateShoppingList(planId: string): ShoppingList | null {
    const plan = this._plans().find(p => p.id === planId);
    if (!plan) return null;

    const items: ShoppingItem[] = plan.items.flatMap(item => {
      const ing = this.ingredients.find(i => i.id === item.ingredientId);
      return ing
        ? [{
          ingredientId: ing.id,
          ingredientName: ing.name,
          category: ing.category,
          quantity: item.grams,
          unit: ing.unit,
          isChecked: false,
        }]
        : [];
    });

    const list: ShoppingList = {
      id: `list-${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      items,
      generatedAt: new Date().toISOString(),
    };
    this._lists.update(l => [list, ...l]);
    this.write('lists', this._lists());
    return list;
  }

  toggleShoppingItem(listId: string, ingredientId: string): void {
    this._lists.update(lists =>
      lists.map(l =>
        l.id !== listId
          ? l
          : {
            ...l,
            items: l.items.map(i =>
              i.ingredientId === ingredientId ? { ...i, isChecked: !i.isChecked } : i,
            ),
          },
      ),
    );
    this.write('lists', this._lists());
  }

  deleteList(id: string): void {
    this._lists.update(l => l.filter(x => x.id !== id));
    this.write('lists', this._lists());
  }

  // ── Persistencia ──────────────────────────────────────────
  private key(userId: string | undefined, name: string): string {
    return `deficcitto_${name}_${userId ?? 'guest'}`;
  }

  private read<T>(userId: string | undefined, name: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.key(userId, name));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(name: string, value: unknown): void {
    try {
      localStorage.setItem(this.key(this.auth.currentUser()?.id, name), JSON.stringify(value));
    } catch {
      /* almacenamiento lleno o bloqueado: se ignora en esta versión demo */
    }
  }
}
