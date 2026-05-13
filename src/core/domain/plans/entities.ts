import { PlanId, UserId } from '../common/types';
import { Macros } from './value-objects';

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface MealIngredient {
  name: string;
  qty?: number;
  unit?: string;
  category?: string;
}
export interface Meal {
  id?: string;
  slot: MealSlot;
  title: string;
  prepMinutes?: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tags?: string[];
  ingredients?: MealIngredient[];
  instructions?: string;
  imageUrl?: string | null;
}

export interface PlanDay {
  dayIndex: number;
  meals: Meal[];
}

export interface Plan {
  id?: PlanId;
  userId: UserId;
  weekStart: Date;
  macros: Macros;
  notes?: string;
  days: PlanDay[];
}
