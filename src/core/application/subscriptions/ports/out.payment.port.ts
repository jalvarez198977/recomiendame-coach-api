export interface CreateSubscriptionInput {
  planId: string;       // ID del plan en el proveedor de pagos (legacy, no usado en MP)
  planType?: 'monthly' | 'annual';
  userId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  trialDays: number;
  externalReference: string; // userId para identificar en webhook
}

export interface PaymentWebhookEvent {
  type: string;           // 'subscription_authorized' | 'subscription_cancelled' | etc.
  resourceId: string;     // ID del recurso en el proveedor
  data: Record<string, any>;
}

export interface SubscriptionData {
  id: string;
  status: string;         // 'authorized' | 'paused' | 'cancelled' | 'pending'
  nextPaymentDate: Date | null;
  payerId: string;
  payerEmail: string;
  externalReference: string;
  preapprovalPlanId: string | null; // ID del plan en MP para cruzar con SubscriptionPlan
}

export interface IPaymentPort {
  createSubscriptionLink(input: CreateSubscriptionInput): Promise<{ url: string; subscriptionId: string }>;
  parseWebhookEvent(payload: Record<string, any>): Promise<PaymentWebhookEvent>;
  getSubscription(subscriptionId: string): Promise<SubscriptionData>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

export const PAYMENT_PORT = Symbol('PAYMENT_PORT');
