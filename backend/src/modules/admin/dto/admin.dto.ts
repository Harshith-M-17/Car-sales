import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/pagination/cursor-query.dto';
import { Role } from '../../../common/types/auth';
import { ListingStatus } from '../../listings/schemas/listing.schema';
import { UserStatus } from '../../users/schemas/user.schema';

export class AdminListingsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ListingStatus, default: ListingStatus.Pending })
  @IsOptional()
  @IsEnum(ListingStatus)
  status: ListingStatus = ListingStatus.Pending;
}

export class AdminUsersQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Email prefix or name fragment' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class SetUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsIn(Object.values(UserStatus))
  status: UserStatus;
}

export class SetVerificationDto {
  @ApiProperty()
  @IsBoolean()
  verified: boolean;
}
