import { Module } from '@nestjs/common';
import { WorkoutsController } from '../infrastructure/http/workouts.controller';
import { GenerateWeeklyWorkoutPlanUseCase } from '../core/application/workouts/use-cases/generate-weekly-workout-plan.usecase';
import { GetWorkoutPlanUseCase } from '../core/application/workouts/use-cases/get-workout-plan.usecase';
import { DeleteWorkoutPlanUseCase } from '../core/application/workouts/use-cases/delete-workout-plan.usecase';
import { UpdateWorkoutPlanUseCase } from '../core/application/workouts/use-cases/update-workout-plan.usecase';
import { CompleteWorkoutUseCase } from '../core/application/workouts/use-cases/complete-workout.usecase';
import { GetActivityStatsUseCase } from '../core/application/workouts/use-cases/get-activity-stats.usecase';
import { LogFreeExerciseUseCase } from '../core/application/workouts/use-cases/log-free-exercise.usecase';
import { GetFreeExerciseHistoryUseCase } from '../core/application/workouts/use-cases/get-free-exercise-history.usecase';
import { DeleteFreeExerciseUseCase } from '../core/application/workouts/use-cases/delete-free-exercise.usecase';
import { WORKOUT_REPOSITORY } from '../core/application/workouts/ports/out.workout-repository.port';
import { WorkoutPrismaRepository } from '../infrastructure/persistence/prisma/workout.prisma.repository';
import { FREE_EXERCISE_REPOSITORY } from '../core/application/workouts/ports/out.free-exercise-repository.port';
import { FreeExercisePrismaRepository } from '../infrastructure/persistence/prisma/free-exercise.prisma.repository';
import { WORKOUT_PLANNER_AGENT } from '../core/application/workouts/ports/out.workout-planner-agent.port';
import { OpenAIWorkoutPlannerAgent } from '../infrastructure/ai/workout-planner.agent.openai';
import { PROFILE_REPO } from '../core/application/profile/ports/out.profile-repo.port';
import { ProfilesPrismaRepository } from '../infrastructure/persistence/prisma/profiles.prisma.repository';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkoutsController],
  providers: [
    GenerateWeeklyWorkoutPlanUseCase,
    GetWorkoutPlanUseCase,
    DeleteWorkoutPlanUseCase,
    UpdateWorkoutPlanUseCase,
    CompleteWorkoutUseCase,
    GetActivityStatsUseCase,
    LogFreeExerciseUseCase,
    GetFreeExerciseHistoryUseCase,
    DeleteFreeExerciseUseCase,
    { provide: WORKOUT_REPOSITORY, useClass: WorkoutPrismaRepository },
    { provide: FREE_EXERCISE_REPOSITORY, useClass: FreeExercisePrismaRepository },
    { provide: WORKOUT_PLANNER_AGENT, useClass: OpenAIWorkoutPlannerAgent },
    { provide: PROFILE_REPO, useClass: ProfilesPrismaRepository },
    PushNotificationsService,
  ],
  exports: [],
})
export class WorkoutsModule {}
