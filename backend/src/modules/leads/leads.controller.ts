import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { CursorQueryDto } from '../../common/pagination/cursor-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser, Role } from '../../common/types/auth';
import { CreateLeadDto, ReceivedLeadsQueryDto, UpdateLeadDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /** Contact the dealer of a listing; the response includes the branch's phone number. */
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(new Types.ObjectId(user.id), dto);
  }

  @Get('sent')
  sent(@CurrentUser() user: AuthUser, @Query() query: CursorQueryDto) {
    return this.leads.sent(new Types.ObjectId(user.id), query.cursor, query.limit);
  }

  @Roles(Role.Seller)
  @Get('received')
  received(@CurrentUser() user: AuthUser, @Query() query: ReceivedLeadsQueryDto) {
    return this.leads.received(new Types.ObjectId(user.id), query);
  }

  @Roles(Role.Seller)
  @Get('received/new-count')
  async newCount(@CurrentUser() user: AuthUser) {
    return { count: await this.leads.countNew(new Types.ObjectId(user.id)) };
  }

  @Roles(Role.Seller)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(new Types.ObjectId(user.id), id, dto);
  }
}
