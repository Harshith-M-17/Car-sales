import { Body, Controller, Get, Header, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/types/auth';
import { SellerProfileDto, UpdateMeDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/auth.dto';
import { clientMeta } from './token.service';

/** The signed-in user's own account. */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.users.getView(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(new Types.ObjectId(user.id), dto);
  }

  /** Upgrades a buyer to a seller; returns a new access token with the seller role. */
  @Post('seller-profile')
  becomeSeller(@CurrentUser() user: AuthUser, @Body() dto: SellerProfileDto) {
    return this.auth.becomeSeller(new Types.ObjectId(user.id), dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Patch('password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(new Types.ObjectId(user.id), dto, clientMeta(req));
  }
}
