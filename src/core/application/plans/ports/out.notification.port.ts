export interface NotificationPort {
  notify(userId: string, title: string, body: string, data?: Record<string, any>): Promise<void>;
}
export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
