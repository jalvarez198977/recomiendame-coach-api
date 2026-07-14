import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import {
  CreateSubscriptionInput,
  IPaymentPort,
  PaymentWebhookEvent,
  SubscriptionData,
} from '../../core/application/subscriptions/ports/out.payment.port';

@Injectable()
export class MercadoPagoAdapter implements IPaymentPort {
  private readonly client: MercadoPagoConfig;
  private readonly logger = new Logger(MercadoPagoAdapter.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new MercadoPagoConfig({
      accessToken: configService.get<string>('MP_ACCESS_TOKEN')!,
      options: { timeout: 5000 },
    });
  }

  async createSubscriptionLink(
    input: CreateSubscriptionInput,
  ): Promise<{ url: string; subscriptionId: string }> {
    const preApproval = new PreApproval(this.client);

    const isAnnual = input.planType === 'annual';
    const amount = isAnnual
      ? Number(this.configService.get('MP_PLAN_ANNUAL_AMOUNT') ?? 5990)
      : Number(this.configService.get('MP_PLAN_MONTHLY_AMOUNT') ?? 3990);
    const currency = this.configService.get<string>('MP_CURRENCY') ?? 'CLP';
    const apiUrl =
      this.configService.get<string>('API_URL') ??
      'https://api-coach.recomiendameapp.cl';
    const isTest = this.configService.get('NODE_ENV') !== 'production';
    const payerEmail = isTest
      ? (this.configService.get<string>('MP_TEST_PAYER_EMAIL') ?? input.customerEmail)
      : input.customerEmail;

    const body: any = {
      reason: isAnnual ? 'Coach PRO — Plan Anual' : 'Coach PRO — Plan Mensual',
      external_reference: `${input.externalReference}|${input.planType ?? 'monthly'}`,
      payer_email: payerEmail,
      back_url: `${apiUrl}/subscriptions/payment-return`,
      notification_url: `${apiUrl}/subscriptions/webhook`,
      auto_recurring: {
        frequency: isAnnual ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: currency,
      },
      status: 'pending',
    };

    const sub = await preApproval.create({ body });

    this.logger.log(
      `PreApproval creado: id=${sub.id}, notification_url=${apiUrl}/subscriptions/webhook`,
    );

    if (!sub.init_point) {
      throw new Error('El PreApproval no tiene init_point disponible');
    }

    return { url: sub.init_point, subscriptionId: sub.id! };
  }

  async parseWebhookEvent(
    payload: Record<string, any>,
  ): Promise<PaymentWebhookEvent> {
    const type = payload.type as string;
    const resourceId = payload.data?.id as string;

    this.logger.log(`Webhook recibido: type=${type}, id=${resourceId}`);

    return { type, resourceId, data: payload };
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionData> {
    const preApproval = new PreApproval(this.client);
    const sub = await preApproval.get({ id: subscriptionId });

    this.logger.log(`PreApproval raw: ${JSON.stringify(sub)}`);

    // external_reference tiene formato "userId|planType"
    const rawRef = sub.external_reference ?? '';
    const [userId, planType] = rawRef.includes('|')
      ? rawRef.split('|')
      : [rawRef, null];

    return {
      id: sub.id!,
      status: sub.status!,
      nextPaymentDate: sub.next_payment_date
        ? new Date(sub.next_payment_date)
        : null,
      payerId: String(sub.payer_id ?? ''),
      payerEmail: (sub as any).payer_email ?? '',
      externalReference: userId,
      preapprovalPlanId: planType,
    };
  }

  async getInvoicePreapprovalId(invoiceId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.mercadopago.com/authorized_payments/${invoiceId}`,
        { headers: { Authorization: `Bearer ${this.configService.get('MP_ACCESS_TOKEN')}` } },
      );
      if (!response.ok) return null;
      const data: any = await response.json();
      this.logger.log(`Invoice ${invoiceId} → preapproval_id=${data.preapproval_id}`);
      return data.preapproval_id ?? null;
    } catch (e) {
      this.logger.warn(`No se pudo obtener invoice ${invoiceId}: ${(e as Error).message}`);
      return null;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const preApproval = new PreApproval(this.client);
    await preApproval.update({
      id: subscriptionId,
      body: { status: 'cancelled' },
    });
    this.logger.log(`PreApproval cancelado: id=${subscriptionId}`);
  }
}
