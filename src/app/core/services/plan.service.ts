import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../errors/api-error';
import { INGREDIENT_CATALOG } from '../data/ingredients.data';
import {
  Ingredient, NutritionPlan, PlanItem, PlanPayload, ShoppingItem, ShoppingList, UserProfile,
} from '../models/app.models';
import { AuthService } from './auth.service';
import { NutritionService } from './nutrition.service';
import { PlansApiService } from './plans-api.service';

export const DEFAULT_PROFILE: UserProfile = {
  sex: 'male', age: 25, weightKg: 70, heightCm: 170,
  activity: 'moderate', objective: 'maintenance',
};

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Estado del dashboard.
 *  - Planes: viven en la API (`PlansApiService`); aquí se guardan en una señal como caché.
 *  - Perfil y listas de compras: siguen en localStorage, por usuario.
 *
 * Los métodos de planes que escriben devuelven una promesa y NUNCA lanzan: si la API
 * falla, el interceptor global ya avisó al usuario y el método devuelve `null`/`false`.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private auth      = inject(AuthService);
  private nutrition = inject(NutritionService);
  private plansApi  = inject(PlansApiService);

  /** Catálogo disponible para armar planes. */
  readonly ingredients: Ingredient[] = INGREDIENT_CATALOG;

  // ── Estado ────────────────────────────────────────────────
  private _profile = signal<UserProfile>(DEFAULT_PROFILE);
  private _plans   = signal<NutritionPlan[]>([]);
  private _lists   = signal<ShoppingList[]>([]);
  private _plansStatus = signal<LoadStatus>('idle');
  private _plansError  = signal<ApiError | null>(null);

  readonly profile = this._profile.asReadonly();
  readonly plans   = this._plans.asReadonly();
  readonly lists   = this._lists.asReadonly();

  /** Estado de la carga de planes: sirve para pintar cargando / error / vacío. */
  readonly plansStatus = this._plansStatus.asReadonly();
  readonly plansError  = this._plansError.asReadonly();
  readonly plansLoading = computed(() => this._plansStatus() === 'loading');

  // ── Derivados ─────────────────────────────────────────────
  readonly tdee = computed(() => this.nutrition.calculateTdee(this._profile()));
  readonly goals = computed(() => this.nutrition.calculateMacroGoals(this._profile()));
  readonly favoritesCount = computed(() => this._plans().filter(p => p.isFavorite).length);

  constructor() {
    // Carga inicial síncrona: los componentes que se construyen enseguida ya ven los datos guardados.
    this.load(this.auth.currentUser()?.id);

    // Recarga los datos cuando cambia el usuario (login / logout).
    effect(() => this.load(this.auth.currentUser()?.id));

    // Los planes vienen de la API.
    void this.loadPlans();
  }

  private load(userId: string | undefined): void {
    this._profile.set(this.read<UserProfile>(userId, 'profile', DEFAULT_PROFILE));
    this._lists.set(this.read<ShoppingList[]>(userId, 'lists', []));
  }

  // ── Perfil ────────────────────────────────────────────────
  updateProfile(profile: UserProfile): void {
    this._profile.set(profile);
    this.write('profile', profile);
  }

  // ── Planes ────────────────────────────────────────────────
  /** Trae todos los planes de la API. Si falla, avisa (toast) y deja `plansStatus = 'error'`. */
  async loadPlans(): Promise<void> {
    this._plansStatus.set('loading');
    this._plansError.set(null);
    try {
      const page = await firstValueFrom(this.plansApi.list({ sort: 'createdAt', order: 'desc' }, { notify: true }));
      this._plans.set(page.items);
      this._plansStatus.set('loaded');
    } catch (error) {
      this._plansError.set(toApiError(error));
      this._plansStatus.set('error');
    }
  }

  /** Crea un plan. Devuelve el plan guardado, o `null` si la API falló. */
  async savePlan(name: string, items: PlanItem[], description = ''): Promise<NutritionPlan | null> {
    try {
      const plan = await firstValueFrom(this.plansApi.create(this.buildPayload(name, items, description)));
      this._plans.update(list => [plan, ...list]);
      return plan;
    } catch {
      return null; // el interceptor ya avisó al usuario
    }
  }

  /** Reemplaza nombre, ingredientes y descripción de un plan existente. `null` si falló. */
  async updatePlan(
    id: string, name: string, items: PlanItem[], description = '',
  ): Promise<NutritionPlan | null> {
    const current = this._plans().find(p => p.id === id);
    try {
      const payload: PlanPayload = {
        ...this.buildPayload(name, items, description),
        // al editar se conservan la fecha de creación, el favorito y las etiquetas
        ...(current && { createdAt: current.createdAt, isFavorite: current.isFavorite, tags: current.tags }),
      };
      const plan = await firstValueFrom(this.plansApi.update(id, payload));
      this._plans.update(list => list.map(p => (p.id === id ? plan : p)));
      return plan;
    } catch {
      return null;
    }
  }

  /** Elimina un plan. Devuelve `true` si se borró. */
  async deletePlan(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.plansApi.remove(id));
      this._plans.update(list => list.filter(p => p.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  /** Marca o desmarca un plan como favorito. Devuelve `true` si se guardó. */
  async toggleFavorite(id: string): Promise<boolean> {
    const current = this._plans().find(p => p.id === id);
    if (!current) return false;
    try {
      const plan = await firstValueFrom(this.plansApi.patch(id, { isFavorite: !current.isFavorite }));
      this._plans.update(list => list.map(p => (p.id === id ? plan : p)));
      return true;
    } catch {
      return false;
    }
  }

  private buildPayload(name: string, items: PlanItem[], description: string): PlanPayload {
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      macroGoals: this.nutrition.calculateTotals(items, this.ingredients),
      items,
      createdAt: new Date().toISOString(),
      isFavorite: false,
      tags: [this._profile().objective],
    };
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
