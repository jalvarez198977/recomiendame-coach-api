import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCheckoutSessionUseCase } from '../../core/application/subscriptions/use-cases/create-checkout-session.usecase';
import { HandleWebhookUseCase } from '../../core/application/subscriptions/use-cases/handle-webhook.usecase';
import { GetSubscriptionStatusUseCase } from '../../core/application/subscriptions/use-cases/get-subscription-status.usecase';
import { GetSubscriptionPlansUseCase } from '../../core/application/subscriptions/use-cases/get-subscription-plans.usecase';
import { ActivatePlanFromPreapprovalUseCase } from '../../core/application/subscriptions/use-cases/activate-plan-from-preapproval.usecase';
import { CancelSubscriptionUseCase } from '../../core/application/subscriptions/use-cases/cancel-subscription.usecase';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('subscriptions')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class SubscriptionsController {
  constructor(
    private readonly createCheckoutSession: CreateCheckoutSessionUseCase,
    private readonly handleWebhook: HandleWebhookUseCase,
    private readonly getSubscriptionStatus: GetSubscriptionStatusUseCase,
    private readonly getSubscriptionPlans: GetSubscriptionPlansUseCase,
    private readonly activatePlanFromPreapproval: ActivatePlanFromPreapprovalUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
  ) {}

  @Get('plans')
  plans() {
    return this.getSubscriptionPlans.execute();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Req() req: any, @Body() dto: CreateCheckoutDto) {
    const planType = dto.planType ?? 'monthly';
    const result = await this.createCheckoutSession.execute({
      userId: req.user.userId,
      planId: planType,
      planType,
    });
    return { checkoutUrl: result.checkoutUrl };
  }

  @Get('payment-return')
  @Redirect()
  async paymentReturn(
    @Query('preapproval_id') preapprovalId: string,
    @Query('status') status: string,
  ) {
    if (preapprovalId) {
      await this.activatePlanFromPreapproval.execute(preapprovalId);
    }

    // Redirigir al deep link de la app según el estado del pago
    if (status === 'failure') {
      return { url: 'coachapp://payment-failure', statusCode: 302 };
    }
    if (status === 'pending') {
      return { url: 'coachapp://payment-pending', statusCode: 302 };
    }
    // approved o sin status → success
    return { url: 'coachapp://payment-success', statusCode: 302 };
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() payload: Record<string, any>) {
    try {
      await this.handleWebhook.execute(payload);
      return { received: true };
    } catch (err) {
      throw new BadRequestException(err?.message ?? 'Webhook error');
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@Req() req: any) {
    return this.getSubscriptionStatus.execute(req.user.userId);
  }

  @Post('cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  cancel(@Req() req: any) {
    return this.cancelSubscription.execute(req.user.userId);
  }
}
