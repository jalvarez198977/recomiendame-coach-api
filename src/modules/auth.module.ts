import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppMailerModule } from '../infrastructure/mailer/mailer.module';
import { AuthController } from '../infrastructure/http/auth.controller';
import { LoginUseCase } from '../core/application/auth/use-cases/login.usecase';
import { TOKEN_SIGNER } from '../core/application/auth/ports/out.token-signer.port';
import { JwtTokenAdapter } from '../infrastructure/auth/jwt-token.adapter';
import { JwtStrategy } from '../infrastructure/auth/jwt.strategy';
import { USER_REPOSITORY } from '../core/application/users/ports/out.user-repository.port';
import { UserPrismaRepository } from '../infrastructure/persistence/prisma/user.prisma.repository';
import { HASH_PORT } from '../core/application/users/ports/out.hash.port';
import { BcryptAdapter } from '../infrastructure/crypto/bcrypt.adapter';
import { RequestResetPasswordUseCase } from 'src/core/application/auth/use-cases/request-reset-password.usecase';
import { PASSWORD_RESET_REPO } from 'src/core/application/auth/ports/out.password-reset-repo.port';
import { PasswordResetPrismaRepository } from 'src/infrastructure/persistence/prisma/password-reset.prisma.repository';
import { MAILER_PORT } from 'src/core/application/auth/ports/out.mailer.port';
import { TOKEN_GENERATOR } from 'src/core/application/auth/ports/out.token-generator.port';
import { CryptoTokenGenerator } from 'src/infrastructure/security/token-generator.adapter';
import { ResetPasswordUseCase } from 'src/core/application/auth/use-cases/reset-password.usecase';
import { EmailVerificationPrismaRepository } from 'src/infrastructure/persistence/prisma/email-verification.prisma.repository';
import { EMAIL_VERIF_REPO } from 'src/core/application/auth/ports/out.email-verification-repo.port';
import { EmailAdapter } from 'src/infrastructure/mailer/email.adapter';
import { MailerModule } from '@nestjs-modules/mailer';
import { AuthVerifyController } from 'src/infrastructure/http/auth.verify.controller';
import { RequestEmailVerificationUseCase } from 'src/core/application/auth/use-cases/request-email-verification.usecase';
import { ResendEmailVerificationUseCase } from 'src/core/application/auth/use-cases/resend-email-verification.usecase';
import { VerifyEmailUseCase } from 'src/core/application/auth/use-cases/verify-email.usecase';
import { RequestAccountDeletionUseCase } from 'src/core/application/auth/use-cases/request-account-deletion.usecase';
import { ConfirmAccountDeletionUseCase } from 'src/core/application/auth/use-cases/confirm-account-deletion.usecase';
import { ACCOUNT_DELETION_REPO } from 'src/core/application/auth/ports/out.account-deletion-repo.port';
import { AccountDeletionPrismaRepository } from 'src/infrastructure/persistence/prisma/account-deletion.prisma.repository';
import { AuthAccountDeletionController } from 'src/infrastructure/http/auth.account-deletion.controller';
import { AccountDeletionController } from 'src/infrastructure/http/account-deletion.controller';
import { AuthClerkController } from 'src/infrastructure/http/auth.clerk.controller';
import { ClerkAuthUseCase } from 'src/core/application/auth/use-cases/clerk-auth.usecase';
import { CLERK_AUTH_REPOSITORY } from 'src/core/application/auth/ports/out.clerk-auth-repository.port';
import { ClerkAuthPrismaRepository } from 'src/infrastructure/persistence/prisma/clerk-auth.prisma.repository';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaModule } from '../infrastructure/database/prisma.module';


@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any },
    }),
    PrismaModule,
    AppMailerModule,
  ],
  controllers: [AuthController, AuthVerifyController, AuthAccountDeletionController, AccountDeletionController, AuthClerkController],
  providers: [
    LoginUseCase,
    RequestResetPasswordUseCase,
    ResetPasswordUseCase,
    JwtStrategy,
    { provide: TOKEN_SIGNER, useClass: JwtTokenAdapter },
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
    { provide: HASH_PORT, useClass: BcryptAdapter },
    { provide: PASSWORD_RESET_REPO, useClass: PasswordResetPrismaRepository },
    { provide: TOKEN_GENERATOR, useClass: CryptoTokenGenerator },
    { provide: EMAIL_VERIF_REPO, useClass: EmailVerificationPrismaRepository },
    { provide: ACCOUNT_DELETION_REPO, useClass: AccountDeletionPrismaRepository },
    { provide: MAILER_PORT, useClass: EmailAdapter },
    RequestEmailVerificationUseCase, ResendEmailVerificationUseCase, VerifyEmailUseCase,
    RequestAccountDeletionUseCase, ConfirmAccountDeletionUseCase,
    ClerkAuthUseCase,
    { provide: CLERK_AUTH_REPOSITORY, useClass: ClerkAuthPrismaRepository },
  ],
  exports: [],
})
export class AuthModule {}
