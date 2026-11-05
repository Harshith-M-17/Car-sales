import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { Role } from '../../common/types/auth';
import { CacheService } from '../../infra/cache/cache.service';
import { RejectListingDto } from '../listings/dto/listing.dto';
import { ListingsService } from '../listings/listings.service';
import { UsersService } from '../users/users.service';
import {
  AdminListingsQueryDto,
  AdminUsersQueryDto,
  SetUserStatusDto,
  SetVerificationDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.Admin)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly listings: ListingsService,
    private readonly users: UsersService,
    private readonly cache: CacheService,
  ) {}

  @Get('stats')
  stats() {
    return this.cache.wrap('admin:stats', 60, async () => {
      const [usersByRole, listingsByStatus] = await Promise.all([
        this.users.countByRole(),
        this.listings.countByStatus(),
      ]);
      return {
        users: Object.fromEntries(usersByRole.map((r) => [r._id, r.count])),
        listings: listingsByStatus,
      };
    });
  }

  @Get('listings')
  listListings(@Query() query: AdminListingsQueryDto) {
    return this.listings.moderationQueue(query.status, query.cursor, query.limit);
  }

  @HttpCode(200)
  @Post('listings/:id/approve')
  approve(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.approve(id);
  }

  @HttpCode(200)
  @Post('listings/:id/reject')
  reject(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: RejectListingDto) {
    return this.listings.reject(id, dto.reason);
  }

  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.users.listForAdmin(query);
  }

  @Patch('users/:id/status')
  setStatus(@Param('id', ParseObjectIdPipe) id: Types.ObjectId, @Body() dto: SetUserStatusDto) {
    return this.users.setStatus(id, dto.status);
  }

  @Patch('users/:id/verification')
  setVerification(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: SetVerificationDto,
  ) {
    return this.users.setSellerVerified(id, dto.verified);
  }
}
