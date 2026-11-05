import { Body, Controller, Delete, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser, Role } from '../../common/types/auth';
import { BranchDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { ListingsService } from './listings.service';

/** A dealer's own branches. Every route returns the updated account. */
@ApiTags('me')
@ApiBearerAuth()
@Roles(Role.Seller)
@Controller('me/branches')
export class BranchesController {
  constructor(
    private readonly users: UsersService,
    private readonly listings: ListingsService,
  ) {}

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: BranchDto) {
    return this.users.addBranch(new Types.ObjectId(user.id), dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: BranchDto,
  ) {
    return this.users.updateBranch(new Types.ObjectId(user.id), id, dto);
  }

  @HttpCode(200)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.listings.removeBranch(new Types.ObjectId(user.id), id);
  }
}
