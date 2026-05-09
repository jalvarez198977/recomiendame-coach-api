import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'CANCELLED' | 'PENDING';

@Injectable()
export class GetSubscriptionStatusUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        planExpiresAt: true,
        trialStartedAt: true,
        stripeSubscriptionId: true, // almacena el preapproval ID de MP
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { planType: true, status: true },
        },
      },
    });

    if (!user || user.plan === 'FREE') {
      return { plan: 'FREE' };
    }

    // Determinar planType desde el último pago registrado
    const lastPayment = user.payments?.[0];
    const planType: 'monthly' | 'annual' =
      lastPayment?.planType === 'annual' ? 'annual' : 'monthly';

    // Determinar status
    let status: SubscriptionStatus = 'ACTIVE';
    const now = new Date();

    if (user.trialStartedAt && !user.planExpiresAt) {
      status = 'TRIAL';
    } else if (!user.stripeSubscriptionId) {
      // Sin preapproval activo → cancelado pero aún con acceso
      status = 'CANCELLED';
    } else if (user.planExpiresAt && user.planExpiresAt < now) {
      status = 'CANCELLED';
    } else {
      status = 'ACTIVE';
    }

    return {
      plan: 'PRO',
      status,
      planType,
      currentPeriodEnd: user.planExpiresAt?.toISOString() ?? null,
    };
  }
}
