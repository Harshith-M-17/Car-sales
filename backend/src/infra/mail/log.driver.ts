import { Logger } from '@nestjs/common';
import { MailDriver, MailMessage } from './mail.driver';

/** Development only (config refuses it in production): writes emails to the API log. */
export class LogMailDriver implements MailDriver {
  private readonly logger = new Logger('Mail');

  send({ to, subject, text }: MailMessage): Promise<void> {
    this.logger.log(`To ${to} | ${subject} | ${text}`);
    return Promise.resolve();
  }
}
