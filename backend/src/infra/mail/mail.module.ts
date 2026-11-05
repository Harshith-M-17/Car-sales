import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { LogMailDriver } from './log.driver';
import { MAIL_DRIVER, MailDriver } from './mail.driver';
import { SmtpMailDriver } from './smtp.driver';

@Module({
  providers: [
    {
      provide: MAIL_DRIVER,
      inject: [APP_CONFIG],
      useFactory: ({ mail }: AppConfig): MailDriver =>
        mail.driver === 'smtp' ? new SmtpMailDriver(mail.from, mail.smtp) : new LogMailDriver(),
    },
  ],
  exports: [MAIL_DRIVER],
})
export class MailModule {}
