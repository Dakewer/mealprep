import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RippleDirective } from '../../shared/directives/ripple.directive';

interface FaqItem {
  question: string;
  answer: string;
  open: boolean;
}

interface StorageTip {
  food: string;
  icon: string;
  fridgeDays: string;
  freezerMonths: string;
  proTip: string;
}

@Component({
  selector: 'app-how-it-works-page',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, RippleDirective],
  templateUrl: './how-it-works-page.component.html',
  styleUrl: './how-it-works-page.component.css',
})
export class HowItWorksPageComponent {
  // ── 1. Mini Calculadora Rápida TDEE en Vivo ───────────────
  gender = signal<'male' | 'female'>('male');
  age = signal<number>(28);
  weight = signal<number>(72);
  height = signal<number>(172);
  activity = signal<number>(1.375); // 1.2 sedentario, 1.375 ligero, 1.55 moderado
  goal = signal<'deficit' | 'maintenance' | 'surplus'>('deficit');

  // Cálculo en tiempo real con fórmula Mifflin-St Jeor
  bmr = computed(() => {
    // Mifflin-St Jeor
    // Hombres: 10 * peso + 6.25 * altura - 5 * edad + 5
    // Mujeres: 10 * peso + 6.25 * altura - 5 * edad - 161
    const base = 10 * this.weight() + 6.25 * this.height() - 5 * this.age();
    return this.gender() === 'male' ? base + 5 : base - 161;
  });

  tdee = computed(() => {
    return Math.round(this.bmr() * this.activity());
  });

  targetCalories = computed(() => {
    if (this.goal() === 'deficit') {
      return Math.round(this.tdee() - 400);
    }
    if (this.goal() === 'surplus') {
      return Math.round(this.tdee() + 300);
    }
    return this.tdee();
  });

  // ── 2. Cronograma de Cocina en 90 Minutos ─────────────────
  activeTimelinePhase = signal<number>(1);

  timelinePhases = [
    {
      phase: 1,
      time: 'Min 00 - 15',
      title: 'Mise en place y precalentado',
      icon: '🔪',
      action: 'Lava y corta vegetales, sazona tus proteínas y precalienta el horno a 200°C.',
      tip: 'Usa una sola tabla grande para no ensuciar múltiples utensilios.',
    },
    {
      phase: 2,
      time: 'Min 15 - 55',
      title: 'Cocción inteligente en paralelo',
      icon: '🔥',
      action: 'Mete las bandejas de pollo y verduras al horno, mientras en la estufa se cocina el arroz o la quinoa.',
      tip: 'El horno trabaja por ti sin que tengas que estar cuidando la sartén.',
    },
    {
      phase: 3,
      time: 'Min 55 - 75',
      title: 'Enfriamiento y porcionado',
      icon: '🍱',
      action: 'Deja que los alimentos bajen de temperatura para evitar condensación y reparte en tus tuppers.',
      tip: 'Usa la lista de porciones que te da Deficcitto para armar 4 o 5 porciones idénticas en 5 minutos.',
    },
    {
      phase: 4,
      time: 'Min 75 - 90',
      title: 'Etiquetado y refrigeración',
      icon: '❄️',
      action: 'Cierra herméticamente y guarda en el refri los días 1 a 3; si vas a comer el día 4 o 5, mete al congelador.',
      tip: '¡Listo! Tu cocina queda limpia y tienes comida casera y deliciosa para toda la semana.',
    },
  ];

  // ── 3. Guía de Conservación de Alimentos ───────────────────
  storageTips: StorageTip[] = [
    {
      food: 'Pechuga de pollo o carne asada',
      icon: '🍗',
      fridgeDays: '3 a 4 días',
      freezerMonths: 'Hasta 3 meses',
      proTip: 'Guarda con un poco de jugo o salsa para que al calentar no se reseque.',
    },
    {
      food: 'Arroz blanco, integral y quinoa',
      icon: '🍚',
      fridgeDays: '4 a 5 días',
      freezerMonths: 'Hasta 2 meses',
      proTip: 'Añade una cucharadita de agua antes de meter al microondas para revivir la textura.',
    },
    {
      food: 'Verduras al horno (calabaza, zanahoria)',
      icon: '🥕',
      fridgeDays: '4 días',
      freezerMonths: 'No recomendado',
      proTip: 'Quedan perfectas si no las sobrecocinas para que mantengan cierta firmeza.',
    },
    {
      food: 'Hojas verdes y ensaladas frescas',
      icon: '🥗',
      fridgeDays: '5 a 6 días',
      freezerMonths: 'No congelar',
      proTip: 'Guárdalas bien secas en un tupper con una toalla de papel absorbente debajo.',
    },
  ];

  // ── 4. Acordeón de FAQ Interactivo ────────────────────────
  faqs = signal<FaqItem[]>([
    {
      question: '¿La comida en tuppers sigue sabiendo rica después de 3 o 4 días?',
      answer:
        '¡Totalmente! El secreto está en no sobrecocinar los vegetales y agregar los aderezos o salsas frescas justo al momento de comer. Además, la guía te indica qué alimentos congelar para comerlos como recién hechos.',
      open: true,
    },
    {
      question: '¿Necesito comprar recipientes caros de vidrio para empezar?',
      answer:
        'No. Puedes empezar perfectamente con recipientes libres de BPA que ya tengas en casa. Más adelante, si deseas, los tuppers de vidrio con cierre hermético conservan el calor y sabor de forma óptima.',
      open: false,
    },
    {
      question: '¿Qué pasa si un día tengo un compromiso social y como fuera?',
      answer:
        'Deficcitto es flexible. Si te sobra una porción que no consumiste ese día, simplemente métela al congelador y úsala la siguiente semana, ¡así evitas desperdicio y resuelves otra comida futura!',
      open: false,
    },
    {
      question: '¿Tengo que comer lo mismo todos los días?',
      answer:
        'Para nada. La plataforma te permite armar menús combinando 2 o 3 opciones distintas (por ejemplo, 3 comidas con pollo al pesto y 2 con fajitas de res), compartiendo ingredientes base para que no te canses.',
      open: false,
    },
    {
      question: '¿Cuánto tiempo tardo realmente en cocinar toda la semana?',
      answer:
        'La mayoría de nuestros usuarios tardan entre 75 y 90 minutos un domingo o lunes por la tarde. Una vez que tienes el hábito, el tiempo pasa volando.',
      open: false,
    },
  ]);

  toggleFaq(index: number) {
    this.faqs.update(items =>
      items.map((item, i) => (i === index ? { ...item, open: !item.open } : item))
    );
  }
}
