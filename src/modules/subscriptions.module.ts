import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { SubscriptionsController } from '../infrastructure/http/subscriptions.controller';
import { PAYMENT_PORT } from '../core/application/subscriptions/ports/out.payment.port';
import { MercadoPagoAdapter } from '../infrastructure/mercadopago/mercadopago.adapter';
import { CreateCheckoutSessionUseCase } from '../core/application/subscriptions/use-cases/create-checkout-session.usecase';
import { HandleWebhookUseCase } from '../core/application/subscriptions/use-cases/handle-webhook.usecase';
import { GetSubscriptionStatusUseCase } from '../core/application/subscriptions/use-cases/get-subscription-status.usecase';
import { GetSubscriptionPlansUseCase } from '../core/application/subscriptions/use-cases/get-subscription-plans.usecase';
import { ActivatePlanFromPreapprovalUseCase } from '../core/application/subscriptions/use-cases/activate-plan-from-preapproval.usecase';
import { CancelSubscriptionUseCase } from '../core/application/subscriptions/use-cases/cancel-subscription.usecase';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PlanExpiryService } from './plan-expiry.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SubscriptionsController],
  providers: [
    { provide: PAYMENT_PORT, useClass: MercadoPagoAdapter },
    CreateCheckoutSessionUseCase,
    HandleWebhookUseCase,
    GetSubscriptionStatusUseCase,
    GetSubscriptionPlansUseCase,
    ActivatePlanFromPreapprovalUseCase,
    CancelSubscriptionUseCase,
    PrismaService,
    ConfigService,
    PlanExpiryService,
  ],
})
export class SubscriptionsModule {}
