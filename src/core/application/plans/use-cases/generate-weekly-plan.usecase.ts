import { Inject, Injectable } from '@nestjs/common';

import {
  GenerateWeeklyPlanInput,
  GenerateWeeklyPlanOutput,
} from '../dto/generate-weekly-plan.dto';

import {
  PLAN_REPOSITORY,
  PlanRepositoryPort,
} from '../ports/out.plan-repository.port';

import {
  MEAL_PLANNER_AGENT,
  MealPlannerAgentPort,
} from '../ports/out.meal-planner-agent.port';

import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../ports/out.notification.port';

import {
  PROFILE_REPO,
  ProfileRepoPort,
} from '../../profile/ports/out.profile-repo.port';

import { Macros, Week } from '../../../domain/plans/value-objects';
import { ok, err, Result } from '../../../domain/common/result';
import { Plan } from '../../../domain/plans/entities';

@Injectable()
export class GenerateWeeklyPlanUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort,
    @Inject(MEAL_PLANNER_AGENT) private readonly agent: MealPlannerAgentPort,
    @Inject(NOTIFICATION_PORT) private readonly notifier: NotificationPort,
    @Inject(PROFILE_REPO) private readonly profiles: ProfileRepoPort,
  ) {}

  async execute(
    input: GenerateWeeklyPlanInput,
  ): Promise<Result<GenerateWeeklyPlanOutput>> {
    const week = Week.fromISOWeek(input.isoWeek);

    const macros = new Macros(
      input.protein_g,
      input.carbs_g,
      input.fat_g,
      input.kcalTarget,
    );

    // Si ya existe un plan para esa semana, devolvemos su id (idempotencia)
    const exists = await this.plans.findByUserAndWeek(input.userId, week.start);
    if (exists) {
      return ok({ planId: exists.id!, created: false });
    }

    // Preferencias del usuario (alergias/gustos) para enriquecer el prompt del agente
    const profile = await this.profiles.get(input.userId);
    const preferences = {
      allergies: (profile.allergies ?? []).map((a) => a.name),
      cuisinesLike: (profile.cuisinesLike ?? []).map((c) => c.name),
      cuisinesDislike: (profile.cuisinesDislike ?? []).map((c) => c.name),
      cookTimePerMeal: profile.cookTimePerMeal,
      nutritionGoal: profile.nutritionGoal,
      targetWeightKg: profile.targetWeightKg,
      timeFrame: profile.timeFrame,
      intensity: profile.intensity,
      currentMotivation: profile.currentMotivation,
    };

    // Llamada al agente (OpenAI u otro motor) para proponer las comidas de la semana
    const draft = await this.agent.draftWeekPlan({
      userId: input.userId,
      weekStart: week.start,
      macros,
      preferences,
    });

    // Persistimos el plan propuesto
    const plan: Plan = {
      userId: input.userId,
      weekStart: week.start,
      macros,
      notes: draft.notes,
      days: draft.days,
    };

    const saved = await this.plans.save(plan);
    if (!saved.ok) return err(saved.error);

    await this.notifier.notify(
      input.userId,
      'Plan semanal creado',
      `Tu plan para la semana ${input.isoWeek} está listo ✨`,
      {
        type: 'PLAN_READY',
        planId: saved.value.id!,
        week: input.isoWeek,
      },
    );

    return ok({ planId: saved.value.id!, created: true });
  }
}
