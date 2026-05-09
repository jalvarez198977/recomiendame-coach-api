import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../core/application/users/use-cases/create-user.usecase';
import { ListUsersUseCase } from '../../core/application/users/use-cases/list-users.usecase';
import { GetUserUseCase } from '../../core/application/users/use-cases/get-user.usecase';
import { DeleteUserUseCase } from '../../core/application/users/use-cases/delete-user.usecase';
import { CreateUserDto } from '../../core/application/users/dto/create-user.dto';
import { ListUsersDto } from '../../core/application/users/dto/list-users.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FollowUserUseCase } from '../../core/application/users/use-cases/follow-user.usecase';
import { UnfollowUserUseCase } from '../../core/application/users/use-cases/unfollow-user.usecase';
import { SearchUsersUseCase } from '../../core/application/users/use-cases/search-users.usecase';
import { GetSuggestedUsersUseCase } from '../../core/application/users/use-cases/get-suggested-users.usecase';
import { GetUserFollowersUseCase } from '../../core/application/users/use-cases/get-user-followers.usecase';
import { GetUserFollowingUseCase } from '../../core/application/users/use-cases/get-user-following.usecase';
import { GetUserProfileUseCase } from '../../core/application/users/use-cases/get-user-profile.usecase';
import { PrismaService } from '../database/prisma.service';
import { UsageLimitService, computeWindowBounds } from '../../core/application/plan/usage-limit.service';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { FEATURE_GATES } from '../../core/application/plan/feature-gates';

@Controller('users')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly deleteUser: DeleteUserUseCase,
    private readonly followUser: FollowUserUseCase,
    private readonly unfollowUser: UnfollowUserUseCase,
    private readonly searchUsers: SearchUsersUseCase,
    private readonly getSuggestedUsers: GetSuggestedUsersUseCase,
    private readonly getUserFollowers: GetUserFollowersUseCase,
    private readonly getUserFollowing: GetUserFollowingUseCase,
    private readonly getUserProfile: GetUserProfileUseCase,
    private readonly prisma: PrismaService,
    private readonly usageLimitService: UsageLimitService,
  ) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.createUser.execute(dto);
  }

  @Get()
  list(@Query() q: ListUsersDto) {
    return this.listUsers.execute(q);
  }

  // Buscar usuarios
  @Get('search')
  @UseGuards(JwtAuthGuard)
  search(
    @Req() req: any,
    @Query('q') query: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const viewerId = req.user.userId;
    return this.searchUsers.execute(
      query,
      {
        skip: skip ? Number(skip) : 0,
        take: take ? Number(take) : 20,
      },
      viewerId,
    );
  }

  // Usuarios sugeridos
  @Get('suggested')
  @UseGuards(JwtAuthGuard)
  suggested(
    @Req() req: any,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const userId = req.user.userId;
    return this.getSuggestedUsers.execute(userId, {
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 10,
    });
  }

  // Debug endpoint para verificar un usuario específico
  @Get('debug/check/:targetUserId')
  @UseGuards(JwtAuthGuard)
  async debugCheckUser(
    @Param('targetUserId') targetUserId: string,
    @Req() req: any,
  ) {
    const userId = req.user.userId;

    // Verificar directamente en la tabla Follow
    const followRecord = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: targetUserId,
        },
      },
    });

    // Consulta como en getSuggestedUsers
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        followers: {
          where: { followerId: userId },
          select: { followerId: true },
        },
      },
    });

    return {
      myId: userId,
      targetUserId,
      directFollowCheck: !!followRecord,
      prismaQueryResult: user?.followers || [],
      isFollowedByMeFromQuery: (user?.followers?.length || 0) > 0,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  get(@Param('id') id: string, @Req() req: any) {
    const viewerId = req.user.userId;
    return this.getUserProfile.execute(id, viewerId);
  }

  // Seguidores del usuario
  @Get(':userId/followers')
  @UseGuards(JwtAuthGuard)
  followers(
    @Param('userId') userId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.getUserFollowers.execute(userId, {
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
    });
  }

  // A quién sigue el usuario
  @Get(':userId/following')
  @UseGuards(JwtAuthGuard)
  following(
    @Param('userId') userId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.getUserFollowing.execute(userId, {
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
    });
  }

  // Seguir usuario
  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('userId') userId: string, @Req() req: any) {
    const followerId = req.user.userId;
    return this.followUser.execute(followerId, userId);
  }

  // Dejar de seguir usuario
  @Delete(':userId/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('userId') userId: string, @Req() req: any) {
    const followerId = req.user.userId;
    return this.unfollowUser.execute(followerId, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async delete(
    @Param('id') id: string,
    @Body() dto?: { confirmation?: string },
  ) {
    return this.deleteUser.execute(id, dto?.confirmation);
  }

  // PATCH /users/me/plan
  @Patch('me/plan')
  @UseGuards(JwtAuthGuard)
  async updatePlan(@Req() req: any, @Body() dto: UpdatePlanDto) {
    const userId = req.user.userId;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: dto.plan,
        ...(dto.planExpiresAt ? { planExpiresAt: new Date(dto.planExpiresAt) } : {}),
      },
      select: { id: true, email: true, plan: true, planExpiresAt: true },
    });
  }

  // PATCH /users/me/onboarding
  @Patch('me/onboarding')
  @UseGuards(JwtAuthGuard)
  async updateOnboarding(@Req() req: any, @Body() dto: UpdateOnboardingDto) {
    const userId = req.user.userId;
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: dto.completed, onboardingStep: dto.step },
      select: { id: true, onboardingCompleted: true, onboardingStep: true },
    });
  }

  // GET /users/me/usage
  @Get('me/usage')
  @UseGuards(JwtAuthGuard)
  async getUsage(@Req() req: any) {
    const userId = req.user.userId;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    const FREE_LIMITED_FEATURES = Object.entries(FEATURE_GATES)
      .filter(([, cfg]) => cfg.tier === 'FREE_LIMITED')
      .map(([key, cfg]) => ({ key, limit: cfg.limit!, window: cfg.window! }));

    // Features PRO-only: siempre sin límite
    const PRO_ONLY_FEATURES = Object.entries(FEATURE_GATES)
      .filter(([, cfg]) => cfg.tier === 'PRO')
      .map(([key]) => key);

    const features: Record<string, any> = {};

    // PRO-only features: sin límite para todos
    for (const key of PRO_ONLY_FEATURES) {
      features[key] = { current: 0, limit: null, resetsAt: null };
    }

    if (user?.plan === 'PRO') {
      // PRO: todas las features limitadas también quedan sin límite
      for (const f of FREE_LIMITED_FEATURES) {
        features[f.key] = { current: 0, limit: null, resetsAt: null };
      }
      return { features };
    }

    // FREE: calcular uso real de features limitadas
    const now = new Date();
    for (const f of FREE_LIMITED_FEATURES) {
      const { start, end } = computeWindowBounds(f.window, now);
      const result = await this.prisma.usageLog.aggregate({
        _sum: { count: true },
        where: { userId, feature: f.key, date: { gte: start, lt: end } },
      });
      const current = result._sum.count ?? 0;
      features[f.key] = { current, limit: f.limit, resetsAt: end };
    }

    return { features };
  }
}
