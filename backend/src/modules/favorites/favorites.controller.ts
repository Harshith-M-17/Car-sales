import { Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { CursorQueryDto } from '../../common/pagination/cursor-query.dto';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CursorQueryDto) {
    return this.favorites.list(new Types.ObjectId(user.id), query.cursor, query.limit);
  }

  @Put(':listingId')
  @HttpCode(204)
  add(
    @CurrentUser() user: AuthUser,
    @Param('listingId', ParseObjectIdPipe) listingId: Types.ObjectId,
  ) {
    return this.favorites.add(new Types.ObjectId(user.id), listingId);
  }

  @Delete(':listingId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('listingId', ParseObjectIdPipe) listingId: Types.ObjectId,
  ) {
    return this.favorites.remove(new Types.ObjectId(user.id), listingId);
  }
}
