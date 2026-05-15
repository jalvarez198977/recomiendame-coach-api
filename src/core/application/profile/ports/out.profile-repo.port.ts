export interface ProfileRepoPort {
  get(userId: string): Promise<any>; // shape plana para el front
  update(userId: string, patch: {
    name?: string; lastName?: string; avatarUrl?: string | null;
    sex?: string; birthDate?: string; heightCm?: number; weightKg?: number;
    activityLevel?: string; country?: string; budgetLevel?: number; cookTimePerMeal?: number;
    nutritionGoal?: string; targetWeightKg?: number; timeFrame?: string; intensity?: string; currentMotivation?: string;
  }): Promise<void>;
  updateAvatar(userId: string, avatarUrl: string): Promise<{ avatarUrl: string }>;

  replaceAllergies(userId: string, allergyIds: number[]): Promise<void>;
  replaceConditions(userId: string, conditionIds: number[]): Promise<void>;
  replaceCuisinePrefs(userId: string, likeIds: number[], dislikeIds: number[]): Promise<void>;
}
export const PROFILE_REPO = Symbol('PROFILE_REPO');
