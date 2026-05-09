import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { IPaymentPort, PAYMENT_PORT } from '../ports/out.payment.port';

@Injectable()
export class CancelSubscriptionUseCase {
  private readonly logger = new Logger(CancelSubscriptionUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PORT) private readonly paymentPort: IPaymentPort,
  ) {}

  async execute(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, stripeSubscriptionId: true },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.plan !== 'PRO') {
      throw new BadRequestException('No tienes una suscripción activa');
    }
    if (!user.stripeSubscriptionId) {
      throw new BadRequestException('No se encontró una suscripción activa para cancelar');
    }

    // Cancelar en MercadoPago (pausa el preapproval)
    try {
      await (this.paymentPort as any).cancelSubscription(user.stripeSubscriptionId);
    } catch (err) {
      this.logger.warn(`No se pudo cancelar en MP: ${(err as Error).message}. Marcando como cancelado localmente.`);
    }

    // Marcar localmente: quitar el preapproval ID para que status quede CANCELLED
    // pero mantener plan PRO hasta que expire planExpiresAt
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeSubscriptionId: null },
    });

    this.logger.log(`Suscripción cancelada para userId=${userId}`);
    return { message: 'Suscripción cancelada exitosamente' };
  }
}
