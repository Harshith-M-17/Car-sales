import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PHONE_PATTERN, SellerProfileDto } from '../../users/dto/user.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PasswordFields {
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain a letter and a number' })
  password: string;
}

export class RegisterDto extends PasswordFields {
  @ApiProperty({ example: 'Ravi Kumar' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'ravi@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone: string;

  @ApiProperty({ enum: ['buyer', 'seller'], default: 'buyer' })
  @IsIn(['buyer', 'seller'])
  accountType: 'buyer' | 'seller' = 'buyer';

  @ApiPropertyOptional({ type: SellerProfileDto, description: 'Required when accountType=seller' })
  @ValidateIf((o: RegisterDto) => o.accountType === 'seller')
  @IsDefined()
  @ValidateNested()
  @Type(() => SellerProfileDto)
  sellerProfile?: SellerProfileDto;
}

export class LoginDto {
  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token returned when signing in' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'newPassword must contain a letter and a number',
  })
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto extends PickType(ChangePasswordDto, ['newPassword']) {
  @ApiProperty({ description: 'The token from the emailed reset link' })
  @IsString()
  @MaxLength(256)
  token: string;
}
