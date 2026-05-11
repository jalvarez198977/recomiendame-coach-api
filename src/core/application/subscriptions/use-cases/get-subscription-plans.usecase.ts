import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface SubscriptionPlanDto {
  id: string;
  label: string;
  price: string;
  period: string;
  badge: string | null;
  saving: string | null;
}

@Injectable()
export class GetSubscriptionPlansUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<SubscriptionPlanDto[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        label: true,
        price: true,
        period: true,
        badge: true,
        saving: true,
      },
    });

    return plans;
  }
}
