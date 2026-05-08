import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ClerkGuard } from '../auth/clerk.guard';
import { ClerkAuthUseCase } from '../../core/application/auth/use-cases/clerk-auth.usecase';
import { ClerkAuthDto } from '../../core/application/auth/dto/clerk-auth.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthClerkController {
  constructor(private readonly clerkAuthUC: ClerkAuthUseCase) {}

  /**
   * POST /auth/clerk
   *
   * Flujo Lookup & Link:
   *  1. Valida el Bearer token con Clerk SDK
   *  2. Busca usuario por clerkId → si existe, genera JWT
   *  3. Si no, busca por email → vincula clerkId al registro existente
   *  4. Si tampoco existe, crea un usuario nuevo
   *  5. Devuelve el JWT del sistema
   */
  @UseGuards(ClerkGuard)
  @Post('clerk')
  async clerkAuth(@Req() req: any, @Body() dto: ClerkAuthDto) {
    return this.clerkAuthUC.execute({
      clerkId: req.clerkUserId,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }
}
