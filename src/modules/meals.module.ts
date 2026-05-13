import { Module } from '@nestjs/common';
import { MealsController } from '../infrastructure/http/meals.controller';
import { LogMealUseCase } from '../core/application/meals/use-cases/log-meal.usecase';
import { GetMealsTodayUseCase } from '../core/application/meals/use-cases/get-meals-today.usecase';
import { MarkMealConsumedUseCase } from '../core/application/meals/use-cases/mark-meal-consumed.usecase';
import { AnalyzeMealImageUseCase } from '../core/application/meals/use-cases/analyze-meal-image.usecase';
import { DeleteMealLogUseCase } from '../core/application/meals/use-cases/delete-meal-log.usecase';
import { TranscribeAudioUseCase } from '../core/application/meals/use-cases/transcribe-audio.usecase';
import { GetMealDetailsUseCase } from '../core/application/plans/use-cases/get-meal-details.usecase';
import { OpenAIMealDetailsAgent } from '../infrastructure/ai/meal-details.agent.openai';
import { PrismaMealRepository } from '../infrastructure/persistence/prisma/meal.prisma.repository';
import { MEAL_DETAILS_AGENT } from '../core/application/plans/ports/out.meal-details-agent.port';
import { MEAL_REPOSITORY } from '../core/application/plans/ports/out.meal-repository.port';
import { IMAGE_SEARCH_PORT } from '../core/application/plans/ports/out.image-search.port';
import { PexelsService } from '../infrastructure/images/pexels.service';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { NotificationsModule } from './notifications.module';
import { UsageLimitService } from '../core/application/plan/usage-limit.service';
import { USAGE_LOG_PORT } from '../core/application/plan/ports/out.usage-log.port';
import { UsageLogPrismaRepository } from '../infrastructure/database/usage-log.prisma.repository';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [MealsController],
  providers: [
    LogMealUseCase,
    GetMealsTodayUseCase,
    MarkMealConsumedUseCase,
    AnalyzeMealImageUseCase,
    DeleteMealLogUseCase,
    TranscribeAudioUseCase,
    GetMealDetailsUseCase,
    { provide: MEAL_DETAILS_AGENT, useClass: OpenAIMealDetailsAgent },
    { provide: MEAL_REPOSITORY, useClass: PrismaMealRepository },
    { provide: IMAGE_SEARCH_PORT, useClass: PexelsService },
    PexelsService,
    UsageLimitService,
    { provide: USAGE_LOG_PORT, useClass: UsageLogPrismaRepository },
  ],
})
export class MealsModule {}
