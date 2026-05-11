import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IPaymentPort, PAYMENT_PORT } from '../ports/out.payment.port';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@Injectable()
export class CreateCheckoutSessionUseCase {
  constructor(
    @Inject(PAYMENT_PORT) private readonly paymentPort: IPaymentPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute({ userId, planId, planType }: { userId: string; planId: string; planType?: 'monthly' | 'annual' }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${userId}`);
    }

    // Resolver el planType: si no viene explícito, inferirlo del planId
    const resolvedPlanType: 'monthly' | 'annual' = planType ?? (planId === 'annual' ? 'annual' : 'monthly');

    // Buscar el plan en la base de datos para obtener el ID real de Mercado Pago
    const subscriptionPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: resolvedPlanType, isActive: true },
      select: { mercadoPagoPreapprovalPlanId: true },
    });

    if (!subscriptionPlan) {
      throw new NotFoundException(`Plan de suscripción no encontrado: ${resolvedPlanType}`);
    }

    const result = await this.paymentPort.createSubscriptionLink({
      planId: subscriptionPlan.mercadoPagoPreapprovalPlanId,
      planType: resolvedPlanType,
      userId,
      customerEmail: user.email,
      successUrl: 'recomiendame://payment-success',
      cancelUrl: 'recomiendame://payment-cancel',
      trialDays: 3,
      externalReference: userId,
    });

    return { checkoutUrl: result.url };
  }
}
