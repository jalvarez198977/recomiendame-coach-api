import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../users/ports/out.user-repository.port';
import { HASH_PORT, HashPort } from '../../users/ports/out.hash.port';
import { TOKEN_SIGNER, TokenSignerPort } from '../ports/out.token-signer.port';
import { MAILER_PORT, MailerPort } from '../ports/out.mailer.port';
import { TOKEN_GENERATOR, TokenGeneratorPort } from '../ports/out.token-generator.port';
import { EMAIL_VERIF_REPO, EmailVerificationRepoPort } from '../ports/out.email-verification-repo.port';
import {
  PROMO_CODE_REPOSITORY,
  PromoCodeRepositoryPort,
} from '../../promo-codes/ports/out.promo-code-repository.port';
import { RegisterDto } from '../dto/register.dto';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(HASH_PORT) private readonly hasher: HashPort,
    @Inject(TOKEN_SIGNER) private readonly tokens: TokenSignerPort,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    @Inject(TOKEN_GENERATOR) private readonly tokenGen: TokenGeneratorPort,
    @Inject(EMAIL_VERIF_REPO) private readonly verifs: EmailVerificationRepoPort,
    @Inject(PROMO_CODE_REPOSITORY) private readonly promoCodes: PromoCodeRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: RegisterDto): Promise<{
    message: string;
    userId: string;
    email: string;
    promoApplied: boolean;
  }> {
    const email = dto.email.toLowerCase().trim();

    // 1. Verificar que el email no esté en uso
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo electrónico.');
    }

    // 2. Hashear contraseña
    const passwordHash = await this.hasher.hash(dto.password);

    // 3. Crear usuario (plan PRO por defecto temporalmente)
    const user = await this.users.create({ email, passwordHash });

    // 4. Aplicar código promo si viene
    let promoApplied = false;
    if (dto.promoCode) {
      const normalized = dto.promoCode.trim().toUpperCase();
      const validCode = await this.promoCodes.findValidCode(normalized);
      if (validCode) {
        await this.promoCodes.consumeCode(validCode.id, user.id);
        promoApplied = true;
        this.logger.log(`🎟️ Código promo ${normalized} aplicado al usuario ${email}`);
      } else {
        this.logger.warn(`⚠️ Código promo inválido o ya usado: ${normalized} (usuario ${email})`);
      }
    }

    // 5. Enviar email de verificación
    const token = this.tokenGen.generate();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min

    await this.verifs.create({ userId: user.id, tokenHash, expiresAt });

    const frontUrl = this.config.get<string>('FRONT_URL', 'http://localhost:3000');
    const verifyUrl = `${frontUrl}/verify-email?token=${token}`;
    const fullName = dto.name ?? email;
    const logoUrl = 'https://coach.recomiendameapp.cl/_nuxt/logo.kI-BB8D4.png';

    await this.mailer.sendEmailVerification(
      email,
      'Confirma tu correo en Coach Recomiéndame',
      'welcome',
      { fullName, logoUrl, verifyUrl },
    );

    return {
      message: 'Cuenta creada exitosamente. Revisa tu correo para verificar tu email.',
      userId: user.id,
      email,
      promoApplied,
    };
  }
}
