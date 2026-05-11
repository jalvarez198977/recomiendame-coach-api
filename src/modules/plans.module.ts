import { Module } from '@nestjs/common';
import { PlansController } from '../infrastructure/http/plans.controller';
import { GenerateWeeklyPlanUseCase } from '../core/application/plans/use-cases/generate-weekly-plan.usecase';
import { PLAN_REPOSITORY } from '../core/application/plans/ports/out.plan-repository.port';
import { PlanPrismaRepository } from '../infrastructure/persistence/prisma/plan.prisma.repository';
import { MEAL_PLANNER_AGENT } from '../core/application/plans/ports/out.meal-planner-agent.port';
import { NOTIFICATION_PORT } from '../core/application/plans/ports/out.notification.port';
import { InAppNotificationAdapter } from '../infrastructure/notifications/inapp.notification.adapter';
import { PushNotificationsService } from './push-notifications.service';
import { GetPlanByIdUseCase } from 'src/core/application/plans/use-cases/get-plan-by-id.usecase';
import { DeleteMealPlanUseCase } from 'src/core/application/plans/use-cases/delete-meal-plan.usecase';
import { GetPlanByWeekUseCase } from 'src/core/application/plans/use-cases/get-plan-by-week.usecase';
import { OpenAIMealPlannerAgent } from 'src/infrastructure/ai/meal-planner.agent.openai';
import { ProfileModule } from './profile.module';
import { RegeneratePlanDayUseCase } from 'src/core/application/plans/use-cases/regenerate-plan-day.usecase';
import { SwapMealUseCase } from 'src/core/application/plans/use-cases/swap-meal.usecase';
import { PrismaModule } from 'src/infrastructure/database/prisma.module';
import { GetShoppingListUseCase } from 'src/core/application/plans/use-cases/get-shopping-list.usecase';
import { GenerateShoppingListUseCase } from 'src/core/application/plans/use-cases/generate-shopping-list.usecase';
import { PROFILE_REPO } from 'src/core/application/profile/ports/out.profile-repo.port';
import { ProfilesPrismaRepository } from 'src/infrastructure/persistence/prisma/profiles.prisma.repository';
import { MacrosService } from 'src/core/application/plans/services/macros.service';
import { UnitConverterService } from 'src/core/application/plans/services/unit-converter.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlansController],
  providers: [
    GenerateWeeklyPlanUseCase,
    GetPlanByIdUseCase,
    DeleteMealPlanUseCase,
    GetPlanByWeekUseCase,
    RegeneratePlanDayUseCase,
    SwapMealUseCase,
    GetShoppingListUseCase,
    GenerateShoppingListUseCase,
    MacrosService,
    UnitConverterService,
    PushNotificationsService,
    { provide: PLAN_REPOSITORY, useClass: PlanPrismaRepository },
    { provide: MEAL_PLANNER_AGENT, useClass: OpenAIMealPlannerAgent },
    { provide: NOTIFICATION_PORT, useClass: InAppNotificationAdapter },
    { provide: PROFILE_REPO, useClass: ProfilesPrismaRepository },
  ],
  exports: [],
})
export class PlansModule {}
