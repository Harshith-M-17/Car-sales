import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import {
  IsDefined,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AddressDto {
  @ApiProperty({ example: '12, 100 Feet Road' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  addressLine: string;

  @ApiPropertyOptional({ example: 'Indiranagar' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiProperty({ example: 'Bengaluru' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city: string;

  @ApiProperty({ example: 'Karnataka' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  state: string;

  @ApiProperty({ example: '560038' })
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode: string;
}

export class BranchDto extends AddressDto {
  @ApiProperty({ example: 'Whitefield showroom' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: "Buyers get this number for cars at this branch; defaults to the dealer's own",
  })
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: BranchDto) => o.lng !== undefined || o.lat !== undefined)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: BranchDto) => o.lat !== undefined || o.lng !== undefined)
  @IsLongitude()
  lng?: number;
}

export class SellerProfileDto {
  @ApiProperty({ example: 'Sharma Motors' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName: string;

  @ApiProperty({
    type: AddressDto,
    description: "The dealer's address; becomes their first branch",
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

export class UpdateSellerProfileDto extends PickType(SellerProfileDto, ['businessName']) {}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ type: UpdateSellerProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSellerProfileDto)
  sellerProfile?: UpdateSellerProfileDto;
}
