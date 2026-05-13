export interface MealDetailsIngredient {
  name: string;
  qty: number | null;
  unit: string | null;
  category: string | null;
}

export interface MealDetailsOutput {
  mealId: string;
  title: string;
  ingredients: MealDetailsIngredient[];
  instructions: string;
  imageUrl?: string | null;
}
