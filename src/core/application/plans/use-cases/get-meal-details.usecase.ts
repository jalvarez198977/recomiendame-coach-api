import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MEAL_DETAILS_AGENT, MealDetailsAgentPort } from '../ports/out.meal-details-agent.port';
import { MEAL_REPOSITORY, MealRepositoryPort } from '../ports/out.meal-repository.port';
import { MealDetailsOutput } from '../dto/meal-details.dto';

@Injectable()
export class GetMealDetailsUseCase {
  constructor(
    @Inject(MEAL_REPOSITORY) private readonly meals: MealRepositoryPort,
    @Inject(MEAL_DETAILS_AGENT) private readonly agent: MealDetailsAgentPort,
  ) {}

  async execute(mealId: string, userId: string): Promise<MealDetailsOutput> {
    const meal = await this.meals.findByIdWithOwnership(mealId, userId);

    if (!meal) {
      throw new NotFoundException(`Comida con id "${mealId}" no encontrada.`);
    }

    if (meal.ownerId !== userId) {
      throw new ForbiddenException('No tienes permiso para acceder a esta comida.');
    }

    // Cache hit: ingredientes e instrucciones ya existen en BD
    const isCacheHit = meal.ingredients.length > 0 && meal.instructions !== null;
    if (isCacheHit) {
      return this.toOutput(meal.id, meal.title, meal.ingredients, meal.instructions!, meal.imageUrl);
    }

    // Cache miss: generar con IA y persistir
    const details = await this.agent.generateDetails({ title: meal.title, slot: meal.slot });

    await this.meals.persistDetails(mealId, details);

    return this.toOutput(meal.id, meal.title, details.ingredients, details.instructions, meal.imageUrl);
  }

  private toOutput(
    mealId: string,
    title: string,
    ingredients: Array<{ name: string; qty?: number; unit?: string; category?: string }>,
    instructions: string,
    imageUrl?: string | null,
  ): MealDetailsOutput {
    return {
      mealId,
      title,
      ingredients: ingredients.map((i) => ({
        name: i.name,
        qty: i.qty ?? null,
        unit: i.unit ?? null,
        category: i.category ?? null,
      })),
      instructions,
      imageUrl: imageUrl ?? null,
    };
  }
}
