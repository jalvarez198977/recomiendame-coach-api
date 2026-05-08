import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { TOKEN_SIGNER, TokenSignerPort } from '../ports/out.token-signer.port';
import {
  CLERK_AUTH_REPOSITORY,
  ClerkAuthRepositoryPort,
} from '../ports/out.clerk-auth-repository.port';
import { ClerkAuthDto } from '../dto/clerk-auth.dto';

export interface ClerkAuthInput extends ClerkAuthDto {
  clerkId: string;
}

@Injectable()
export class ClerkAuthUseCase {
  private readonly logger = new Logger(ClerkAuthUseCase.name);

  constructor(
    @Inject(CLERK_AUTH_REPOSITORY)
    private readonly repo: ClerkAuthRepositoryPort,
    @Inject(TOKEN_SIGNER)
    private readonly tokens: TokenSignerPort,
  ) {}

  async execute(input: ClerkAuthInput): Promise<{
    access_token: string;
    user: { id: string; email: string; role: string; emailVerified: boolean };
  }> {
    const { clerkId, email, firstName, lastName } = input;

    if (!clerkId) {
      throw new UnauthorizedException('Token de Clerk inválido');
    }

    // Paso 1: buscar por clerkId
    let user = await this.repo.findByClerkId(clerkId);

    // Paso 2: si no existe por clerkId, buscar por email
    if (!user && email) {
      user = await this.repo.findByEmail(email.toLowerCase());

      if (user) {
        // Paso 3: vincular — el usuario ya existía, le asignamos el clerkId
        user = await this.repo.linkClerkId(user.id, clerkId);
        this.logger.log(`✅ Usuario ${email} vinculado con Clerk exitosamente.`);
      }
    }

    // Paso 4: si sigue sin existir, crear nuevo usuario
    if (!user) {
      user = await this.repo.createFromClerk({
        email: email.toLowerCase(),
        clerkId,
        name: firstName ?? 'Usuario',
        lastName: lastName ?? '',
      });
      this.logger.log(`🆕 Nuevo usuario creado desde Clerk: ${email}`);
    }

    // Paso 5: generar JWT del sistema
    const access_token = this.tokens.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      undefined,
    );

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    };
  }
}
