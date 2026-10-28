import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RippleDirective } from '../../shared/directives/ripple.directive';

interface FeatureDetail {
  id: string;
  category: 'ahorro' | 'salud' | 'tiempo';
  icon: string;
  title: string;
  summary: string;
  detail: string;
  badge: string;
}

@Component({
  selector: 'app-features-page',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, RippleDirective],
  templateUrl: './features-page.component.html',
  styleUrl: './features-page.component.css',
})
export class FeaturesPageComponent {
  // ── Simulador Interactivo de Ahorro ────────────────────────
  householdType = signal<'solo' | 'couple' | 'family'>('solo');
  deliveryMealsPerWeek = signal<number>(4);

  // Cálculos reactivos de ahorro para público general
  monthlySavings = computed(() => {
    const costPerMeal =
      this.householdType() === 'solo' ? 140 : this.householdType() === 'couple' ? 260 : 480;
    const homeCostPerMeal =
      this.householdType() === 'solo' ? 45 : this.householdType() === 'couple' ? 85 : 155;
    const diff = costPerMeal - homeCostPerMeal;
    return diff * this.deliveryMealsPerWeek() * 4;
  });

  hoursSavedPerMonth = computed(() => {
    return Math.round(this.deliveryMealsPerWeek() * 3.5);
  });

  wasteReducedKg = computed(() => {
    const factor =
      this.householdType() === 'solo' ? 1.8 : this.householdType() === 'couple' ? 3.2 : 5.5;
    return (factor * (this.deliveryMealsPerWeek() / 3)).toFixed(1);
  });

  // ── Demostrador Interactivo de Porciones ───────────────────
  calorieTarget = signal<number>(2000);

  proteinGrams = computed(() => Math.round((this.calorieTarget() * 0.25) / 4));
  carbsGrams   = computed(() => Math.round((this.calorieTarget() * 0.50) / 4));
  fatGrams     = computed(() => Math.round((this.calorieTarget() * 0.25) / 9));

  // ── Filtro de Características ──────────────────────────────
  selectedCategory = signal<'all' | 'ahorro' | 'salud' | 'tiempo'>('all');

  featuresList: FeatureDetail[] = [
    {
      id: 'lista-compras',
      category: 'ahorro',
      icon: '🛒',
      title: 'Lista de compras exacta por pasillos',
      badge: 'Cero desperdicio',
      summary: 'Lleva únicamente los gramos y piezas que vas a cocinar.',
      detail:
        'El sistema suma los ingredientes de todo tu menú semanal y los organiza por categorías de supermercado: Verduras, Carnes, Abarrotes y Lácteos. ¡Tildas cada producto mientras compras!',
    },
    {
      id: 'batch-cooking',
      category: 'tiempo',
      icon: '⏱️',
      title: 'Planificación para cocinar en 90 minutos',
      badge: 'Ahorro de tiempo',
      summary: 'Cocina un día y olvídate de la cocina de lunes a viernes.',
      detail:
        'Deficcitto diseña tus recetas para que uses el horno y la estufa al mismo tiempo. En hora y media tendrás tus recipientes listos y limpios para toda tu semana de trabajo o estudio.',
    },
    {
      id: 'control-porciones',
      category: 'salud',
      icon: '🥑',
      title: 'Porciones balanceadas sin báscula obsesiva',
      badge: 'Nutrición real',
      summary: 'Aprende a servirte lo que tu cuerpo necesita con medidas sencillas.',
      detail:
        'No necesitas ser un matemático ni pesar cada hoja de lechuga. La plataforma te muestra porciones claras en tazas, cucharadas o gramos según tu preferencia.',
    },
    {
      id: 'bolsillo-amigable',
      category: 'ahorro',
      icon: '💰',
      title: 'Optimización de ingredientes compartidos',
      badge: 'Economía en casa',
      summary: 'Reutiliza ingredientes básicos en múltiples platillos deliciosos.',
      detail:
        'Si compras una calabaza o una bolsa de espinacas, el algoritmo te sugiere recetas complementarias para asegurarte de consumirla toda sin que se pudra en el refrigerador.',
    },
    {
      id: 'preferencias-familiares',
      category: 'salud',
      icon: '❤️',
      title: 'Adaptabilidad a gustos y restricciones',
      badge: 'Para todos',
      summary: 'Excluye alimentos que no te gusten o que te causen alergias.',
      detail:
        'Personaliza tu perfil si no consumes lácteos, si eres vegetariano o simplemente si odias el cilantro. Deficcitto respetará tus gustos en cada plan sugerido.',
    },
    {
      id: 'modo-movil',
      category: 'tiempo',
      icon: '📱',
      title: 'Acceso móvil rápido en cualquier lugar',
      badge: 'Practicidad',
      summary: 'Lleva tu plan y lista en tu celular de forma cómoda y rápida.',
      detail:
        'Abre tu lista directamente en el supermercado, marca lo que ya metiste a tu carrito y consulta tu menú del día con un simple tap.',
    },
  ];

  filteredFeatures = computed(() => {
    if (this.selectedCategory() === 'all') {
      return this.featuresList;
    }
    return this.featuresList.filter(f => f.category === this.selectedCategory());
  });

  setHousehold(type: 'solo' | 'couple' | 'family') {
    this.householdType.set(type);
  }

  setCategory(cat: 'all' | 'ahorro' | 'salud' | 'tiempo') {
    this.selectedCategory.set(cat);
  }
}
