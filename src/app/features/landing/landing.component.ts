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
      icon: '🎯',
      title: 'Macros al gramo',
      description:
        'Calcula proteínas, carbohidratos y grasas con precisión milimétrica usando ingredientes reales. Sin aproximaciones, sin olvidos.',
    },
    {
      icon: '⚡',
      title: 'Sliders reactivos',
      description:
        'Ajusta porciones y observa cómo todos tus macros y calorías se actualizan instantáneamente. Control total en tiempo real.',
    },
    {
      icon: '🧮',
      title: 'TDEE personalizado',
      description:
        'Calculamos tu gasto calórico diario con la fórmula Mifflin-St Jeor adaptada a tu nivel de actividad, edad, peso y estatura.',
    },
    {
      icon: '🛒',
      title: 'Lista de compras',
      description:
        'Genera automáticamente tu lista de supermercado con cantidades exactas. Tilda los ingredientes mientras compras.',
    },
    {
      icon: '📅',
      title: 'Planificación semanal',
      description:
        'Distribuye tus comidas a lo largo de la semana y asegura variedad nutricional sin exceder tu déficit o superávit.',
    },
    {
      icon: '❤️',
      title: 'Favoritos y exclusiones',
      description:
        'Guarda tus alimentos favoritos y excluye ingredientes según alergias o preferencias. El sistema lo recuerda todo.',
    },
  ];

  steps: Step[] = [
    {
      number: '01',
      icon: '👤',
      title: 'Crea tu perfil',
      description:
        'Ingresa tu edad, peso, estatura y nivel de actividad. Calculamos tu TDEE de forma automática con la fórmula Mifflin-St Jeor.',
    },
    {
      number: '02',
      icon: '⚙️',
      title: 'Configura tus macros',
      description:
        'Usa nuestros sliders reactivos para distribuir proteínas, carbohidratos y grasas según tu objetivo: déficit, mantenimiento o superávit.',
    },
    {
      number: '03',
      icon: '🛒',
      title: 'Genera tu lista',
      description:
        'Con un clic, Deficcitto crea tu lista de compras semanal con cantidades exactas de cada ingrediente. ¡Listo para el súper!',
    },
  ];

  testimonials: Testimonial[] = [
    {
      initials: 'CM',
      name: 'Carlos Martínez',
      role: 'Atleta aficionado',
      quote:
        '¡Increíble! Por fin una app que me calcula exactamente cuántos gramos de pollo y arroz necesito. Bajé 8 kg en 3 meses sin esfuerzo extra.',
      rating: 5,
      color: '#22c55e',
    },
    {
      initials: 'LR',
      name: 'Laura Rodríguez',
      role: 'Nutrióloga',
      quote:
        'Recomiendo Deficcitto a todos mis pacientes. La precisión de los cálculos es sorprendente y la interfaz es muy intuitiva.',
      rating: 5,
      color: '#f97316',
    },
    {
      initials: 'AP',
      name: 'Andrés Peña',
      role: 'Entrenador personal',
      quote:
        'La lista de compras automática le cambia la vida a mis clientes. Ya no hay excusas para no seguir el plan nutricional.',
      rating: 5,
      color: '#3b82f6',
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
