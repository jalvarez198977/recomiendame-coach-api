import { Injectable, Inject, Logger } from '@nestjs/common';
import { IPaymentPort, PAYMENT_PORT } from '../ports/out.payment.port';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@Injectable()
export class HandleWebhookUseCase {
  private readonly logger = new Logger(HandleWebhookUseCase.name);

  constructor(
    @Inject(PAYMENT_PORT) private readonly paymentPort: IPaymentPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(payload: Record<string, any>) {
    const event = await this.paymentPort.parseWebhookEvent(payload);

    this.logger.log(`Webhook recibido: type=${event.type}, resourceId=${event.resourceId}, payload=${JSON.stringify(payload)}`);

    if (event.type === 'subscription_authorized_payment') {
      await this.handleAuthorizedPayment(event.resourceId, payload);
      return;
    }

    if (event.type !== 'subscription_preapproval') {
      this.logger.log(`Webhook ignorado: type=${event.type}`);
      return;
    }

    const sub = await this.paymentPort.getSubscription(event.resourceId);
    let userId = sub.externalReference;

    if (!userId && sub.payerId) {
      this.logger.warn(`Sin externalReference, buscando por mpPayerId=${sub.payerId}`);
      const user = await this.prisma.user.findUnique({
        where: { mpPayerId: sub.payerId },
        select: { id: true },
      });
      if (user) userId = user.id;
    }

    if (!userId && sub.payerEmail) {
      const user = await this.prisma.user.findUnique({ where: { email: sub.payerEmail }, select: { id: true } });
      if (user) userId = user.id;
    }

    if (!userId) {
      this.logger.warn(`Webhook sin externalReference: id=${event.resourceId}`);
      return;
    }

    switch (sub.status) {
      case 'authorized': {
        const { planType } = await this.resolvePlanInfo(sub.preapprovalPlanId);
        const planAmount = await this.resolvePlanAmount(planType);

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'PRO',
            stripeSubscriptionId: sub.id,
            trialStartedAt: new Date(),
            planExpiresAt: sub.nextPaymentDate,
            mpPayerId: sub.payerId || undefined,
          },
        });
        await this.prisma.payment.create({
          data: {
            userId,
            provider: 'mercadopago',
            preapprovalId: sub.id,
            amount: planAmount,
            currency: 'CLP',
            planType,
            status: 'approved',
          },
        });
        this.logger.log(`Plan PRO activado para userId=${userId}, planType=${planType}, amount=${planAmount}`);
        break;
      }

      case 'paused':
      case 'cancelled': {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'FREE',
            stripeSubscriptionId: null,
          },
        });
        this.logger.log(`Plan degradado a FREE para userId=${userId}, status=${sub.status}`);
        break;
      }

      case 'pending': {
        this.logger.log(`Suscripción pendiente para userId=${userId}`);
        break;
      }

      default:
        this.logger.warn(`Estado de suscripción desconocido: ${sub.status}`);
    }
  }

  /**
   * Busca el planType desde el preapprovalPlanId (que ahora contiene el planType directamente).
   */
  private async resolvePlanInfo(preapprovalPlanId: string | null): Promise<{ planType: string }> {
    if (!preapprovalPlanId) return { planType: 'unknown' };
    return { planType: preapprovalPlanId };
  }

  /**
   * Obtiene el monto del plan desde SubscriptionPlan usando el planType.
   * El price está guardado como string (ej: '$6.990'), lo parseamos a número.
   */
  private async resolvePlanAmount(planType: string): Promise<number> {
    if (planType === 'unknown') return 0;
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: planType },
      select: { price: true },
    });
    if (!plan) return 0;
    // price puede ser '$6.990' o '6990' — extraemos solo los dígitos
    const numeric = plan.price.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10) : 0;
  }

  /**
   * Maneja subscription_authorized_payment: un pago dentro de una suscripción fue aprobado.
   * MP envía el preapproval_id en el payload para identificar la suscripción.
   */
  private async handleAuthorizedPayment(
    invoiceId: string,
    payload: Record<string, any>,
  ) {
    // Intentar obtener preapproval_id del payload primero (simulación/test)
    // En producción real, MP solo envía el invoiceId → consultamos la API
    let preapprovalId =
      payload.data?.preapproval_id ??
      payload.preapproval_id ??
      null;

    // Si no viene en el payload, consultamos el invoice en MP
    if (!preapprovalId) {
      preapprovalId = await this.paymentPort.getInvoicePreapprovalId(invoiceId);
    }

    if (!preapprovalId) {
      this.logger.warn(`subscription_authorized_payment sin preapproval_id, invoiceId=${invoiceId}`);
      return;
    }

    const sub = await this.paymentPort.getSubscription(preapprovalId);
    this.logger.log(`authorized_payment: preapprovalId=${preapprovalId}, status=${sub.status}, externalRef=${sub.externalReference}`);

    let userId = sub.externalReference;

    if (!userId && sub.payerEmail) {
      const user = await this.prisma.user.findUnique({ where: { email: sub.payerEmail }, select: { id: true } });
      if (user) userId = user.id;
    }

    if (!userId) {
      this.logger.warn(`authorized_payment sin userId identificable, preapprovalId=${preapprovalId}`);
      return;
    }

    const { planType } = await this.resolvePlanInfo(sub.preapprovalPlanId);
    const amount = payload.data?.transaction_amount ?? payload.transaction_amount ?? 0;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'PRO',
        stripeSubscriptionId: sub.id,
        planExpiresAt: sub.nextPaymentDate,
        mpPayerId: sub.payerId || undefined,
      },
    });

    await this.prisma.payment.create({
      data: {
        userId,
        provider: 'mercadopago',
        providerPaymentId: invoiceId,
        preapprovalId,
        amount: Math.round(Number(amount)),
        currency: 'CLP',
        planType,
        status: 'approved',
      },
    });

    this.logger.log(`Plan PRO activado via authorized_payment para userId=${userId}, planType=${planType}, amount=${amount}`);
  }
}
