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
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCheckoutSessionUseCase } from '../../core/application/subscriptions/use-cases/create-checkout-session.usecase';
import { HandleWebhookUseCase } from '../../core/application/subscriptions/use-cases/handle-webhook.usecase';
import { GetSubscriptionStatusUseCase } from '../../core/application/subscriptions/use-cases/get-subscription-status.usecase';
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
    private readonly activatePlanFromPreapproval: ActivatePlanFromPreapprovalUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Req() req: any, @Body() dto: CreateCheckoutDto) {
    const monthlyId = this.configService.get<string>('MP_PLAN_MONTHLY_ID')!;
    const annualId = this.configService.get<string>('MP_PLAN_ANNUAL_ID')!;

    let planId: string;
    if (dto.planType) {
      planId = dto.planType === 'annual' ? annualId : monthlyId;
    } else if (dto.priceId === annualId) {
      planId = annualId;
    } else {
      // fallback: cualquier priceId desconocido o el monthly ID → monthly
      planId = monthlyId;
    }

    const result = await this.createCheckoutSession.execute({
      userId: req.user.userId,
      planId,
      planType: dto.planType ?? (planId === annualId ? 'annual' : 'monthly'),
    });
    return { checkoutUrl: result.checkoutUrl };
  }

  @Get('payment-return')
  @Redirect()
  async paymentReturn(@Query('preapproval_id') preapprovalId: string) {
    if (preapprovalId) {
      await this.activatePlanFromPreapproval.execute(preapprovalId);
    }
    const frontUrl = this.configService.get<string>('FRONT_URL') ?? 'https://recomiendameapp.cl';
    return { url: `${frontUrl}/subscription/success`, statusCode: 302 };
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
