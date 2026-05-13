export const MEAL_REPOSITORY = Symbol('MEAL_REPOSITORY');

export interface MealIngredientData {
  name: string;
  qty?: number;
  unit?: string;
  category?: string;
}

export interface MealWithOwnership {
  id: string;
  title: string;
  slot: string;
  ownerId: string;
  ingredients: MealIngredientData[];
  instructions: string | null;
  imageUrl: string | null;
}

export interface MealRepositoryPort {
  findByIdWithOwnership(mealId: string, userId: string): Promise<MealWithOwnership | null>;
  persistDetails(
    mealId: string,
    details: {
      ingredients: MealIngredientData[];
      instructions: string;
    },
  ): Promise<void>;
}
