import { Global, Inject, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './app-config';

/** Injects the validated, typed application config. */
export const InjectConfig = () => Inject(APP_CONFIG);

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
