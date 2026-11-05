import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { MailModule } from '../../infra/mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from './guards';
import { MeController } from './me.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordReset, PasswordResetSchema } from './schemas/password-reset.schema';
import { RefreshSession, RefreshSessionSchema } from './schemas/refresh-session.schema';
import { TokenService } from './token.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    MongooseModule.forFeature([
      { name: RefreshSession.name, schema: RefreshSessionSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
    ]),
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.auth.accessSecret,
        signOptions: { algorithm: 'HS256', issuer: 'carsales-api' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'carsales-api' },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, TokenService, PasswordResetService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
