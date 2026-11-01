import { Ingredient } from '../models/app.models';

/**
 * Catálogo base de ingredientes.
 * Los valores de protein / carbs / fat / calories son por cada 100 g
 * (aproximados, en crudo salvo que el nombre indique lo contrario).
 * `gramsPer100` se mantiene en 100 para respetar el modelo existente.
 */
export const INGREDIENT_CATALOG: Ingredient[] = [
  { id: 'pollo',    name: 'Pechuga de pollo',      category: 'Carnes',    unit: 'g', gramsPer100: 100, protein: 31,   carbs: 0,    fat: 3.6,  calories: 165 },
  { id: 'atun',     name: 'Atún en agua',          category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 26,   carbs: 0,    fat: 1,    calories: 116 },
  { id: 'res',      name: 'Carne molida de res',   category: 'Carnes',    unit: 'g', gramsPer100: 100, protein: 26,   carbs: 0,    fat: 15,   calories: 250 },
  { id: 'huevo',    name: 'Huevo',                 category: 'Lácteos',   unit: 'g', gramsPer100: 100, protein: 12.6, carbs: 0.7,  fat: 9.5,  calories: 143 },
  { id: 'yogur',    name: 'Yogur griego natural',  category: 'Lácteos',   unit: 'g', gramsPer100: 100, protein: 10,   carbs: 3.6,  fat: 0.4,  calories: 59 },
  { id: 'leche',    name: 'Leche descremada',      category: 'Lácteos',   unit: 'g', gramsPer100: 100, protein: 3.4,  carbs: 5,    fat: 0.1,  calories: 34 },
  { id: 'arroz',    name: 'Arroz (crudo)',         category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 6.7,  carbs: 79,   fat: 0.7,  calories: 360 },
  { id: 'avena',    name: 'Avena',                 category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 16.9, carbs: 66,   fat: 6.9,  calories: 389 },
  { id: 'frijol',   name: 'Frijoles cocidos',      category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 8.7,  carbs: 22.8, fat: 0.5,  calories: 127 },
  { id: 'tortilla', name: 'Tortilla de maíz',      category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 5.7,  carbs: 44.6, fat: 2.9,  calories: 218 },
  { id: 'pasta',    name: 'Pasta (cruda)',         category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 13,   carbs: 75,   fat: 1.5,  calories: 371 },
  { id: 'aceite',   name: 'Aceite de oliva',       category: 'Abarrotes', unit: 'g', gramsPer100: 100, protein: 0,    carbs: 0,    fat: 100,  calories: 884 },
  { id: 'brocoli',  name: 'Brócoli',               category: 'Verduras',  unit: 'g', gramsPer100: 100, protein: 2.8,  carbs: 6.6,  fat: 0.4,  calories: 34 },
  { id: 'espinaca', name: 'Espinaca',              category: 'Verduras',  unit: 'g', gramsPer100: 100, protein: 2.9,  carbs: 3.6,  fat: 0.4,  calories: 23 },
  { id: 'jitomate', name: 'Jitomate',              category: 'Verduras',  unit: 'g', gramsPer100: 100, protein: 0.9,  carbs: 3.9,  fat: 0.2,  calories: 18 },
  { id: 'camote',   name: 'Camote',                category: 'Verduras',  unit: 'g', gramsPer100: 100, protein: 1.6,  carbs: 20,   fat: 0.1,  calories: 86 },
  { id: 'aguacate', name: 'Aguacate',              category: 'Verduras',  unit: 'g', gramsPer100: 100, protein: 2,    carbs: 8.5,  fat: 14.7, calories: 160 },
  { id: 'platano',  name: 'Plátano',               category: 'Verduras',  unit: 'g', gramsPer100: 100, protein: 1.1,  carbs: 22.8, fat: 0.3,  calories: 89 },
];
