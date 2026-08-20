import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HandlebarsAdapter } = require('@nestjs-modules/mailer/dist/adapters/handlebars.adapter');
import { EmailAdapter } from './email.adapter';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT ?? 587),
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      },
      defaults: { from: process.env.MAIL_FROM ?? '"Coach" <no-reply@tu-dominio.com>' },
      template: {
        dir: require('path').join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: { strict: true },
      },
    }),
  ],
  providers: [EmailAdapter],
  exports: [EmailAdapter, MailerModule],
})
export class AppMailerModule {}
