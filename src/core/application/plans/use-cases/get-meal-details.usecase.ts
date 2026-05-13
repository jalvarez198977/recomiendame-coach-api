import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MEAL_DETAILS_AGENT, MealDetailsAgentPort } from '../ports/out.meal-details-agent.port';
import { MEAL_REPOSITORY, MealRepositoryPort } from '../ports/out.meal-repository.port';
import { IMAGE_SEARCH_PORT, ImageSearchPort } from '../ports/out.image-search.port';
import { MealDetailsOutput } from '../dto/meal-details.dto';

@Injectable()
export class GetMealDetailsUseCase {
  constructor(
    @Inject(MEAL_REPOSITORY) private readonly meals: MealRepositoryPort,
    @Inject(MEAL_DETAILS_AGENT) private readonly agent: MealDetailsAgentPort,
    @Inject(IMAGE_SEARCH_PORT) private readonly imageSearch: ImageSearchPort,
  ) {}

  async execute(mealId: string, userId: string): Promise<MealDetailsOutput> {
    const meal = await this.meals.findByIdWithOwnership(mealId, userId);

    if (!meal) {
      throw new NotFoundException(`Comida con id "${mealId}" no encontrada.`);
    }

    if (meal.ownerId !== userId) {
      throw new ForbiddenException('No tienes permiso para acceder a esta comida.');
    }

    // Resolver ingredientes/instrucciones (cache o IA)
    const isCacheHit = meal.ingredients.length > 0 && meal.instructions !== null;
    let ingredients = meal.ingredients;
    let instructions = meal.instructions!;

    if (!isCacheHit) {
      const details = await this.agent.generateDetails({ title: meal.title, slot: meal.slot });
      await this.meals.persistDetails(mealId, details);
      ingredients = details.ingredients;
      instructions = details.instructions;
    }

    // Resolver imageUrl: si no está en BD, buscarla en Pexels y persistirla
    let imageUrl = meal.imageUrl;
    if (!imageUrl) {
      imageUrl = await this.imageSearch.searchFoodImage(meal.title);
      if (imageUrl) {
        // Persistir en background para que la próxima vez venga directo de BD
        this.meals.persistImageUrl(mealId, imageUrl).catch(() => null);
      }
    }

    return {
      mealId: meal.id,
      title: meal.title,
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
