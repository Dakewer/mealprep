import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RippleDirective } from '../../shared/directives/ripple.directive';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Step {
  number: string;
  icon: string;
  title: string;
  description: string;
}

interface Testimonial {
  initials: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  color: string;
}

interface Stat {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, RippleDirective],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  // ── Datos estáticos de demostración ───────────────────────

  stats: Stat[] = [
    { value: '1,200+', label: 'Usuarios activos',     icon: '👥' },
    { value: '50K+',   label: 'Planes generados',     icon: '📊' },
    { value: '98%',    label: 'Satisfacción',          icon: '⭐' },
    { value: '0 kcal', label: 'Error promedio',        icon: '🎯' },
  ];

  features: Feature[] = [
    {
      icon: '🥑',
      title: 'Come rico sin complicaciones',
      description:
        'Olvídate de dietas extremas o aburridas. Diseña comidas deliciosas y balanceadas que se adapten a tu ritmo de vida real.',
    },
    {
      icon: '⏱️',
      title: 'Ahorra horas cada semana',
      description:
        'Deja de preguntarte "¿qué cocino hoy?". Organiza tus comidas con anticipación y recupera tu tiempo libre.',
    },
    {
      icon: '💰',
      title: 'Cero comida desperdiciada',
      description:
        'Compra únicamente las cantidades exactas que vas a consumir. Cuida tu bolsillo y dile adiós a los ingredientes olvidados en el refrigerador.',
    },
    {
      icon: '🛒',
      title: 'Lista de compras al instante',
      description:
        'Genera automáticamente tu lista de compras organizada para el supermercado. Marca los productos conforme los pones en tu carrito.',
    },
    {
      icon: '🎯',
      title: 'Control simple de porciones',
      description:
        'Ajusta lo que comes con controles visuales e intuitivos. Sin cálculos matemáticos raros ni fórmulas difíciles de entender.',
    },
    {
      icon: '🍱',
      title: 'Comidas variadas y prácticas',
      description:
        'Combina tus alimentos e ingredientes favoritos para que disfrutes cada comida sin caer en la monotonía.',
    },
  ];

  steps: Step[] = [
    {
      number: '01',
      icon: '📝',
      title: 'Cuéntanos tu meta',
      description:
        'Ingresa tus datos básicos y lo que buscas lograr: comer más sano, mantenerte en tu peso o tener más energía durante el día.',
    },
    {
      number: '02',
      icon: '🥗',
      title: 'Arma tu menú de la semana',
      description:
        'Elige tus ingredientes favoritos y ajusta tus comidas de forma visual con sliders intuitivos que calculan todo por ti.',
    },
    {
      number: '03',
      icon: '🛒',
      title: 'Haz el súper y disfruta',
      description:
        'Descarga tu lista de compras exacta con un clic. Cocina una o dos veces por semana y ten tus comidas listas sin estrés.',
    },
  ];

  testimonials: Testimonial[] = [
    {
      initials: 'SV',
      name: 'Sofía Valenzuela',
      role: 'Mamá y profesionista',
      quote:
        'Trabajo todo el día y siempre terminaba pidiendo delivery. Con Deficcitto resuelvo mis comidas de lunes a viernes en un par de horas el domingo. ¡Ahorro tiempo y dinero!',
      rating: 5,
      color: '#22c55e',
    },
    {
      initials: 'MT',
      name: 'Miguel Ángel Torres',
      role: 'Trabajador remoto',
      quote:
        'Siempre compraba cosas en el supermercado que terminaban echándose a perder. La lista de compras exacta me redujo el gasto un 30% y ahora como mucho mejor.',
      rating: 5,
      color: '#f97316',
    },
    {
      initials: 'MG',
      name: 'Mariana Gómez',
      role: 'Estudiante universitaria',
      quote:
        'Pensaba que comer bien era carísimo y complicado. La app me enseñó a armar platos equilibrados con comida normal de todos los días y sin pasar hambre.',
      rating: 5,
      color: '#3b82f6',
    },
    {
      initials: 'DH',
      name: 'David Herrera',
      role: 'Oficinista',
      quote:
        'Bajé 6 kilos en dos meses sin sentir que estaba a dieta. Saber exactamente qué porciones servirme sin complicarme la vida fue la clave.',
      rating: 5,
      color: '#a855f7',
    },
  ];

  // ── UI state ───────────────────────────────────────────────

  /** Valores demo del hero macro-card */
  proteinPercent  = signal(72);
  carbsPercent    = signal(58);
  fatPercent      = signal(45);

  getStars(rating: number): string[] {
    return Array(rating).fill('★');
  }
}
