import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RippleDirective } from '../../shared/directives/ripple.directive';

export interface UserStory {
  id: string;
  category: 'trabajo' | 'ahorro' | 'familia' | 'salud';
  initials: string;
  name: string;
  role: string;
  city: string;
  rating: number;
  color: string;
  quote: string;
  before: string;
  after: string;
  favoriteMeal: string;
  keyBenefit: string;
}

@Component({
  selector: 'app-testimonials-page',
  standalone: true,
  imports: [RouterLink, FormsModule, RippleDirective],
  templateUrl: './testimonials-page.component.html',
  styleUrl: './testimonials-page.component.css',
})
export class TestimonialsPageComponent {
  selectedCategory = signal<'all' | 'trabajo' | 'ahorro' | 'familia' | 'salud'>('all');

  // Historias de testimonios en vivo
  stories = signal<UserStory[]>([
    {
      id: '1',
      category: 'familia',
      initials: 'SV',
      name: 'Sofía Valenzuela',
      role: 'Mamá y Arquitecta',
      city: 'Monterrey, NL',
      rating: 5,
      color: '#22c55e',
      quote:
        'Trabajo jornadas largas y mis hijos comen en la escuela. Antes vivíamos a base de comida rápida cara. Ahora los domingos en 2 horas dejamos toda la semana lista. Mis hijos comen rico y ahorramos una barbaridad.',
      before: '4 a 5 pedidos de delivery a la semana, comida echándose a perder en el cajón de verduras.',
      after: 'Menú completo listo de lunes a viernes en tuppers, cero estrés y cenas en familia.',
      favoriteMeal: 'Fajitas de pollo al sartén con quinoa y pimientos',
      keyBenefit: 'Ahorro de $2,400 MXN mensuales y más tiempo con sus hijos',
    },
    {
      id: '2',
      category: 'trabajo',
      initials: 'MT',
      name: 'Miguel Ángel Torres',
      role: 'Diseñador UI / Remoto',
      city: 'Guadalajara, JAL',
      rating: 5,
      color: '#f97316',
      quote:
        'Al trabajar desde casa siempre me levantaba sin saber qué comer. Terminaba picando cualquier cosa y a las 3 de la tarde ya no tenía energía. La lista de compras exacta me cambió la rutina por completo.',
      before: 'Interrupciones continuas para cocinar a mediodía, comida chatarra y fatiga por la tarde.',
      after: 'Solo caliento mi bowl en 2 minutos y como balanceado. Mi energía para trabajar es constante.',
      favoriteMeal: 'Bowl de atún marinado con aguacate y arroz integral',
      keyBenefit: '3 horas libres recuperadas cada semana',
    },
    {
      id: '3',
      category: 'ahorro',
      initials: 'MG',
      name: 'Mariana Gómez',
      role: 'Estudiante Universitaria',
      city: 'Ciudad de México',
      rating: 5,
      color: '#3b82f6',
      quote:
        'Mi presupuesto como foránea es limitado. Siempre creí que comer saludable era de gente rica o de influencers. Deficcitto me enseñó a comprar justo lo que uso en el mercado local.',
      before: 'Tiraba la mitad de las verduras porque se pudrían, gastaba de más en tiendas de conveniencia.',
      after: 'Presupuesto de comida controlado al peso, comidas balanceadas sin pasar hambre.',
      favoriteMeal: 'Lentejas guisadas con calabacitas y pechuga de pollo',
      keyBenefit: '35% de reducción en su gasto mensual de comida',
    },
    {
      id: '4',
      category: 'salud',
      initials: 'DH',
      name: 'David Herrera',
      role: 'Contador Público',
      city: 'Querétaro, QRO',
      rating: 5,
      color: '#a855f7',
      quote:
        'Tenía colesterol alto y sobrepeso por comer diario fuera de la oficina. Nunca pude seguir dietas restrictivas porque me daban ansiedad. Con el control visual de porciones bajé 7 kg sin sentirme castigado.',
      before: 'Tacos y comida corrida con exceso de grasa todos los días en horario laboral.',
      after: 'Llevo mi tupper con porciones exactas. Mis análisis clínicos salieron limpios en mi último chequeo.',
      favoriteMeal: 'Pollo al limón y hierbas con papas asadas y brócoli',
      keyBenefit: '7 kg menos en 3 meses y salud cardiovascular recuperada',
    },
    {
      id: '5',
      category: 'trabajo',
      initials: 'EC',
      name: 'Elena Castillo',
      role: 'Enfermera de Turno',
      city: 'Puebla, PUE',
      rating: 5,
      color: '#06b6d4',
      quote:
        'Con los turnos nocturnos en el hospital era imposible mantener una rutina. Llevarme mi comida en recipientes me salvó de las máquinas expendedoras de madrugada.',
      before: 'Snacks azucarados y café durante guardias de 12 horas.',
      after: 'Comidas nutritivas listas para calentar en el microondas del hospital a cualquier hora.',
      favoriteMeal: 'Pechuga deshebrada con salsa verde casera y arroz salvaje',
      keyBenefit: 'Cero pesadez en el turno y digestión perfecta',
    },
    {
      id: '6',
      category: 'ahorro',
      initials: 'RP',
      name: 'Roberto Palacios',
      role: 'Emprendedor',
      city: 'Mérida, YUC',
      rating: 5,
      color: '#eab308',
      quote:
        'Odio hacer filas en el supermercado y no saber qué comprar. Ahora voy con la lista de Deficcitto en el celular, camino directo por los pasillos y en 20 minutos ya estoy de salida.',
      before: 'Vueltas infinitas por los pasillos del súper comprando cosas impulsivas que nunca cocinaba.',
      after: 'Compras rápidas, directas y con el ticket exacto a lo presupuestado.',
      favoriteMeal: 'Salmón a la plancha con espárragos y batata dulce',
      keyBenefit: 'Visitas al súper 50% más rápidas y cero compras impulsivas',
    },
  ]);

  filteredStories = computed(() => {
    if (this.selectedCategory() === 'all') {
      return this.stories();
    }
    return this.stories().filter(s => s.category === this.selectedCategory());
  });

  // ── Formulario Interactivo de Nuevo Testimonio ────────────
  showForm = signal(false);
  formSuccess = signal(false);

  newName = '';
  newRole = '';
  newCity = '';
  newCategory: 'trabajo' | 'ahorro' | 'familia' | 'salud' = 'salud';
  newRating = 5;
  newQuote = '';
  newFavoriteMeal = '';
  newKeyBenefit = '';

  setCategory(cat: 'all' | 'trabajo' | 'ahorro' | 'familia' | 'salud') {
    this.selectedCategory.set(cat);
  }

  setRating(rating: number) {
    this.newRating = rating;
  }

  toggleForm() {
    this.showForm.update(v => !v);
    this.formSuccess.set(false);
  }

  submitStory() {
    if (!this.newName.trim() || !this.newQuote.trim()) {
      return;
    }

    const initials = this.newName
      .split(' ')
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');

    const colors = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#06b6d4', '#eab308'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newStory: UserStory = {
      id: Date.now().toString(),
      category: this.newCategory,
      initials: initials || 'US',
      name: this.newName.trim(),
      role: this.newRole.trim() || 'Miembro de la comunidad',
      city: this.newCity.trim() || 'México',
      rating: this.newRating,
      color: randomColor,
      quote: this.newQuote.trim(),
      before: 'Comía sin plan ni organización antes de probar la app.',
      after: 'Semana planificada y hábitos saludables establecidos.',
      favoriteMeal: this.newFavoriteMeal.trim() || 'Comidas variadas con verduras y proteína',
      keyBenefit: this.newKeyBenefit.trim() || 'Mejora en calidad de vida y bienestar',
    };

    // Añadir al inicio de la lista
    this.stories.update(list => [newStory, ...list]);
    this.formSuccess.set(true);

    // Limpiar campos
    this.newName = '';
    this.newRole = '';
    this.newCity = '';
    this.newQuote = '';
    this.newFavoriteMeal = '';
    this.newKeyBenefit = '';
  }

  getStars(rating: number): string[] {
    return Array(rating).fill('★');
  }
}
