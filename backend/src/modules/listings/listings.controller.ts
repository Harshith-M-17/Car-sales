import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CurrentUser, Public, Roles } from '../../common/decorators/auth.decorators';
import { CursorQueryDto } from '../../common/pagination/cursor-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser, Role } from '../../common/types/auth';
import {
  CreateListingDto,
  MyListingsQueryDto,
  SearchListingsDto,
  UpdateListingDto,
} from './dto/listing.dto';
import { ListingsService } from './listings.service';

/**
 * Anonymous responses can be cached by browsers/CDNs for a short time; personalised
 * ones (with isFavorited) must not be shared.
 */
function cacheFor(res: Response, viewer: AuthUser | undefined, seconds: number) {
  res.setHeader('Vary', 'Authorization');
  res.setHeader(
    'Cache-Control',
    viewer
      ? 'private, no-cache'
      : `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`,
  );
}

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Public()
  @Get()
  async search(
    @Query() query: SearchListingsDto,
    @CurrentUser() viewer: AuthUser | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    cacheFor(res, viewer, 15);
    return this.listings.search(query, viewer);
  }

  @Public()
  @Get('facets')
  async facets(@Query() query: SearchListingsDto, @Res({ passthrough: true }) res: Response) {
    cacheFor(res, undefined, 60);
    return this.listings.facets(query);
  }

  // ---- seller (declared before :id so "mine" isn't parsed as an id)

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: MyListingsQueryDto) {
    return this.listings.mine(new Types.ObjectId(user.id), query);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @Get('mine/stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.listings.sellerStats(new Types.ObjectId(user.id));
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @Get('mine/:id')
  getOwned(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.getOwned(new Types.ObjectId(user.id), id);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.listings.create(new Types.ObjectId(user.id), dto);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(new Types.ObjectId(user.id), id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @HttpCode(200)
  @Post(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.publish(new Types.ObjectId(user.id), id);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @HttpCode(200)
  @Post(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.deactivate(new Types.ObjectId(user.id), id);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @HttpCode(200)
  @Post(':id/mark-sold')
  markSold(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.markSold(new Types.ObjectId(user.id), id);
  }

  @ApiBearerAuth()
  @Roles(Role.Seller)
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.remove(new Types.ObjectId(user.id), id);
  }

  // ---- public detail

  @Public()
  @Get(':id')
  async get(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() viewer: AuthUser | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    cacheFor(res, viewer, 30);
    return this.listings.getPublic(id, viewer);
  }

  /** View beacon: clients call this when the detail page is displayed (not on prefetch). */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(204)
  @Post(':id/views')
  async view(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() viewer: AuthUser | undefined,
    @Req() req: Request,
  ) {
    await this.listings.recordView(id, viewer, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Get(':id/similar')
  async similar(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @CurrentUser() viewer: AuthUser | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    cacheFor(res, viewer, 300);
    return this.listings.similar(id, viewer);
  }
}

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly listings: ListingsService) {}

  @Public()
  @Get(':id')
  async profile(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Res({ passthrough: true }) res: Response,
  ) {
    cacheFor(res, undefined, 300);
    return this.listings.sellerProfile(id);
  }

  @Public()
  @Get(':id/listings')
  async sellerListings(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Query() query: CursorQueryDto,
    @CurrentUser() viewer: AuthUser | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    cacheFor(res, viewer, 30);
    return this.listings.sellerListings(id, query.cursor, query.limit, viewer);
  }
}
