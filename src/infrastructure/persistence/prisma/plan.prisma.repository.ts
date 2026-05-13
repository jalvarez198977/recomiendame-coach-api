import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../../../core/application/plans/ports/out.plan-repository.port';
import { PlanMapper } from './mappers/plan.mapper';
import { Plan } from '../../../core/domain/plans/entities';
import { Result, ok, err } from '../../../core/domain/common/result';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { MEAL_PLANNER_AGENT, MealPlannerAgentPort } from 'src/core/application/plans/ports/out.meal-planner-agent.port';

type Row = {
  category: string | null;
  name: string;
  qty: number | null;
  unit: string | null;
};

function toNum(v: any): number | null {
  return v == null ? null : Number(v);
}

@Injectable()
export class PlanPrismaRepository implements PlanRepositoryPort {
  constructor(
    private prisma: PrismaService,
    @Inject(MEAL_PLANNER_AGENT) private readonly agent: MealPlannerAgentPort,
  ) {}

  async findByUserAndWeek(
    userId: string,
    weekStart: Date,
  ): Promise<Plan | null> {
    const p = await this.prisma.plan.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
      include: {
        days: { include: { meals: { include: { ingredients: true } } } },
      },
    });
    return p ? PlanMapper.fromPrisma(p) : null;
  }

  async save(plan: Plan): Promise<Result<Plan>> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const data = PlanMapper.toPrismaData(plan);
        const p = await tx.plan.create({
          data,
          include: {
            days: { include: { meals: { include: { ingredients: true } } } },
          },
        });
        return p;
      });
      return ok(PlanMapper.fromPrisma(created));
    } catch (e) {
      return err(e as Error);
    }
  }

  async findById(id: string) {
    const p = await this.prisma.plan.findUnique({
        where: { id },
        include: { days: { include: { meals: { include: { ingredients: true } } } } },
    });
    return p ? PlanMapper.fromPrisma(p) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.plan.delete({
      where: { id },
    });
  }

  async replaceDay(planId: string, dayIndex: number, meals: Plan['days'][number]['meals']): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const day = await tx.planDay.findFirst({ where: { planId, dayIndex } });
      if (!day) throw new NotFoundException('PlanDay no encontrado');

      // borrar meals + ingredients actuales
      const currentMeals = await tx.meal.findMany({ where: { planDayId: day.id }, select: { id: true } });
      const mealIds = currentMeals.map(m => m.id);
      if (mealIds.length) {
        await tx.mealIngredient.deleteMany({ where: { mealId: { in: mealIds } } });
        await tx.meal.deleteMany({ where: { id: { in: mealIds } } });
      }

      // crear nuevos (con nested ingredients)
      for (const m of meals) {
        await tx.meal.create({
          data: {
            planDayId: day.id,
            slot: m.slot,
            title: m.title,
            prepMinutes: m.prepMinutes ?? null,
            kcal: m.kcal,
            protein_g: m.protein_g,
            carbs_g: m.carbs_g,
            fat_g: m.fat_g,
            tags: m.tags ?? [],
            instructions: m.instructions ?? null,
            imageUrl: m.imageUrl ?? null,
            ingredients: {
              create: (m.ingredients ?? []).map(i => ({
                name: i.name,
                qty: i.qty ?? null,
                unit: i.unit ?? null,
                category: i.category ?? null,
              })),
            },
          },
        });
      }
    });
  }

  // ── NUEVO: reemplazar UNA comida por índice dentro del día (0-based)
  async replaceMeal(
    planId: string,
    dayIndex: number,
    mealIndex: number,
    meal: Plan['days'][number]['meals'][number],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const day = await tx.planDay.findFirst({
        where: { planId, dayIndex },
        include: { meals: { orderBy: { id: 'asc' }, include: { ingredients: true } } },
      });
      if (!day) throw new NotFoundException('PlanDay no encontrado');
      if (!day.meals[mealIndex]) throw new NotFoundException('Meal index inválido');

      const target = day.meals[mealIndex];

      await tx.mealIngredient.deleteMany({ where: { mealId: target.id } });
      await tx.meal.delete({ where: { id: target.id } });

      await tx.meal.create({
        data: {
          planDayId: day.id,
          slot: meal.slot,
          title: meal.title,
          prepMinutes: meal.prepMinutes ?? null,
          kcal: meal.kcal,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          tags: meal.tags ?? [],
          instructions: meal.instructions ?? null,
          imageUrl: meal.imageUrl ?? null,
          ingredients: {
            create: (meal.ingredients ?? []).map(i => ({
              name: i.name, qty: i.qty ?? null, unit: i.unit ?? null, category: i.category ?? null,
            })),
          },
        },
      });
    });
  }

  async regenerateDayWithAgent(input: {
    planId: string; dayIndex: number; userId: string;
    preferences?: {
      allergies?: string[];
      cuisinesLike?: string[];
      cuisinesDislike?: string[];
      cookTimePerMeal?: number | null;
      nutritionGoal?: string | null;
      targetWeightKg?: number | null;
      timeFrame?: string | null;
      intensity?: string | null;
      currentMotivation?: string | null;
    };
  }): Promise<{ meals: Plan['days'][number]['meals'] }> {
    const { planId, dayIndex, userId, preferences } = input;

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { days: { include: { meals: true } } },
    });
    if (!plan || plan.userId !== userId) throw new NotFoundException('Plan no encontrado');

    const avoidTitles = plan.days.flatMap(d => d.meals.map(m => m.title));
    const macros = { kcalTarget: plan.kcalTarget, protein_g: plan.protein_g, carbs_g: plan.carbs_g, fat_g: plan.fat_g };

    const out = await this.agent.draftDayPlan({
      userId,
      weekStart: plan.weekStart,
      dayIndex,
      macros,
      preferences,
      avoidTitles,
    });

    await this.replaceDay(planId, dayIndex, out.day.meals);
    return { meals: out.day.meals };
  }

  /** Orquesta: calcula target, pide swap y persiste */
  async swapMealWithAgent(input: {
    planId: string; dayIndex: number; mealIndex: number; userId: string;
    preferences?: {
      allergies?: string[];
      cuisinesLike?: string[];
      cuisinesDislike?: string[];
      cookTimePerMeal?: number | null;
      nutritionGoal?: string | null;
      targetWeightKg?: number | null;
      timeFrame?: string | null;
      intensity?: string | null;
      currentMotivation?: string | null;
    };
  }): Promise<{ meal: Plan['days'][number]['meals'][number] }> {
    const { planId, dayIndex, mealIndex, userId, preferences } = input;
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { days: { include: { meals: { orderBy: { id: 'asc' } } } } },
    });
    if (!plan || plan.userId !== userId) throw new NotFoundException('Plan no encontrado');

    const day = plan.days.find(d => d.dayIndex === dayIndex);
    if (!day) throw new NotFoundException('PlanDay no encontrado');
    const current = day.meals[mealIndex];
    if (!current) throw new NotFoundException('Meal index inválido');

    const avoidTitles = plan.days.flatMap(d => d.meals.map(m => m.title));
    const macros = { kcalTarget: plan.kcalTarget, protein_g: plan.protein_g, carbs_g: plan.carbs_g, fat_g: plan.fat_g };

    const out = await this.agent.suggestSwap({
      userId,
      weekStart: plan.weekStart,
      dayIndex,
      macros,
      preferences,
      avoidTitles,
      target: { slot: current.slot as any, kcal: current.kcal },
    });

    await this.replaceMeal(planId, dayIndex, mealIndex, out.meal);
    return { meal: out.meal };
  }


  async getShoppingList(planId: string): Promise<Row[]> {
  const plan = await this.prisma.plan.findUnique({
    where: { id: planId },
    include: {
      days: { include: { meals: { include: { ingredients: true } } } },
    },
  });
  if (!plan) throw new NotFoundException('Plan no encontrado');

  const bucket = new Map<string, Row>();

  for (const d of plan.days) {
    for (const m of d.meals) {
      for (const i of m.ingredients) {
        const key = `${(i.category ?? '').toLowerCase()}|${i.name.toLowerCase()}|${(i.unit ?? '').toLowerCase()}`;
        const current = bucket.get(key);

        const incomingQty = toNum(i.qty);

        if (!current) {
          bucket.set(key, {
            category: i.category ?? null,
            name: i.name,
            qty: incomingQty,
            unit: i.unit ?? null,
          });
        } else {
          if (current.qty != null && incomingQty != null) {
            current.qty += incomingQty;
          } else {
            current.qty = null;
          }
        }
      }
    }
  }

  return Array.from(bucket.values()).sort((a, b) => {
    const ca = (a.category ?? '').localeCompare(b.category ?? '');
    if (ca !== 0) return ca;
    return a.name.localeCompare(b.name);
  });
  }
}
