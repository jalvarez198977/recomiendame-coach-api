import { Injectable, Logger } from '@nestjs/common';
import { NotificationPort } from '../../core/application/plans/ports/out.notification.port';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { PushNotificationsService } from 'src/modules/push-notifications.service';

@Injectable()
export class InAppNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(InAppNotificationAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService,
  ) {}

  async notify(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // 1. Guardar notificación in-app (comportamiento existente)
    await this.prisma.notification.create({ data: { userId, title, body } });

    // 2. Enviar push notification si hay tokens registrados
    try {
      await this.push.sendToUser(userId, { title, body, data: data ?? {} });
    } catch (err) {
      // No bloquear el flujo si el push falla
      this.logger.warn(`Push notification falló para userId=${userId}: ${(err as Error).message}`);
    }
  }
}
