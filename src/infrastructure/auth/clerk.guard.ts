import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

@Injectable()
export class ClerkGuard implements CanActivate {
  private readonly logger = new Logger(ClerkGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de Clerk requerido');
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      // Adjuntamos el userId de Clerk al request para usarlo en el controller
      request.clerkUserId = payload.sub;
      return true;
    } catch (err) {
      this.logger.warn(`Token de Clerk inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token de Clerk inválido o expirado');
    }
  }
}
