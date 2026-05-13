import { Injectable } from '@nestjs/common';
import { MealIngredientData, MealRepositoryPort, MealWithOwnership } from '../../../core/application/plans/ports/out.meal-repository.port';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PrismaMealRepository implements MealRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdWithOwnership(mealId: string, _userId: string): Promise<MealWithOwnership | null> {
    const meal = await this.prisma.meal.findUnique({
      where: { id: mealId },
      include: {
        ingredients: true,
        planDay: {
          include: {
            plan: { select: { userId: true } },
          },
        },
      },
    });

    if (!meal) return null;

    return {
      id: meal.id,
      title: meal.title,
      slot: meal.slot,
      ownerId: meal.planDay.plan.userId,
      ingredients: meal.ingredients.map((i) => ({
        name: i.name,
        qty: i.qty ? Number(i.qty) : undefined,
        unit: i.unit ?? undefined,
        category: i.category ?? undefined,
      })),
      instructions: meal.instructions ?? null,
      imageUrl: meal.imageUrl ?? null,
    };
  }

  async persistImageUrl(mealId: string, imageUrl: string): Promise<void> {
    await this.prisma.meal.update({
      where: { id: mealId },
      data: { imageUrl },
    });
  }

  async persistDetails(
    mealId: string,
    details: { ingredients: MealIngredientData[]; instructions: string },
  ): Promise<void> {
    await this.prisma.$transaction([
      // Eliminar ingredientes previos (si los hubiera de un intento parcial)
      this.prisma.mealIngredient.deleteMany({ where: { mealId } }),
      // Crear nuevos ingredientes
      this.prisma.mealIngredient.createMany({
        data: details.ingredients.map((i) => ({
          mealId,
          name: i.name,
          qty: i.qty ?? null,
          unit: i.unit ?? null,
          category: i.category ?? null,
        })),
      }),
      // Actualizar instrucciones
      this.prisma.meal.update({
        where: { id: mealId },
        data: { instructions: details.instructions },
      }),
    ]);
  }
}
