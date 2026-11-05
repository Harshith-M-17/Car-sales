import { Body, Controller, Header, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/types/auth';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { clientMeta } from './token.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, clientMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, clientMeta(req));
  }

  /** Swaps a refresh token for a new access and refresh token. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, clientMeta(req));
  }

  /** Checks a saved login without using up its refresh token. The site calls this on page load. */
  @Public()
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post('session')
  session(@Body() dto: RefreshDto) {
    return this.auth.currentUser(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  /** Always 204, whether or not the email has an account. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    this.auth.requestPasswordReset(dto.email);
  }

  /** Sets the new password, signs out every device and returns a fresh session. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, clientMeta(req));
  }

  @ApiBearerAuth()
  @HttpCode(204)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthUser) {
    return this.auth.logoutAll(new Types.ObjectId(user.id));
  }
}
