import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CursorQueryDto } from '../../../common/pagination/cursor-query.dto';
import { splitCsv } from '../../../common/utils/strings';
import {
  BODY_TYPES,
  BodyType,
  FUEL_TYPES,
  FuelType,
  TRANSMISSIONS,
  Transmission,
} from '../../catalog/catalog.data';
import { ListingStatus } from '../schemas/listing.schema';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Sorted so equivalent filters share one cache key. */
const csv = ({ value }: { value: unknown }) => splitCsv(value)?.sort();

export class CreateListingDto {
  @ApiProperty({ example: 'maruti-suzuki' })
  @Matches(SLUG)
  makeSlug: string;

  @ApiProperty({ example: 'swift' })
  @Matches(SLUG)
  modelSlug: string;

  @ApiPropertyOptional({ example: 'VXi AMT' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  variant?: string;

  @ApiProperty({ example: 2019 })
  @IsInt()
  @Min(1980)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 42000 })
  @IsInt()
  @Min(0)
  @Max(2_000_000)
  kmDriven: number;

  @ApiProperty({ enum: FUEL_TYPES })
  @IsIn(FUEL_TYPES)
  fuelType: FuelType;

  @ApiProperty({ enum: TRANSMISSIONS })
  @IsIn(TRANSMISSIONS)
  transmission: Transmission;

  @ApiPropertyOptional({ enum: BODY_TYPES })
  @IsOptional()
  @IsIn(BODY_TYPES)
  bodyType?: BodyType;

  @ApiProperty({ example: 1, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  ownerCount: number;

  @ApiPropertyOptional({ example: 'Pearl White' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiProperty({ example: 550000, description: 'Whole rupees' })
  @IsInt()
  @Min(10_000)
  @Max(1_000_000_000)
  price: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;

  @ApiPropertyOptional({ example: 'KA', description: 'RTO state code' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'registrationState must be a 2-letter state code' })
  registrationState?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsISO8601({ strict: true })
  insuranceValidTill?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['abs', 'airbags', 'reverse-camera'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @Matches(SLUG, { each: true })
  features?: string[];

  @ApiProperty({ description: "Which of the dealer's branches the car is at" })
  @IsMongoId()
  branchId: string;

  @ApiProperty({ type: [String], description: 'Ids from POST /media/images, in display order' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true })
  imageIds: string[];

  @ApiPropertyOptional({ default: true, description: 'false saves a draft' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpdateListingDto extends PartialType(
  OmitType(CreateListingDto, ['publish'] as const),
) {}

export enum ListingSort {
  Newest = 'newest',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  KmAsc = 'km_asc',
  YearDesc = 'year_desc',
}

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class SearchListingsDto extends CursorQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search (title, variant, description)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 'bengaluru', description: 'City slug' })
  @IsOptional()
  @Matches(SLUG)
  city?: string;

  @ApiPropertyOptional({
    example: 'maruti-suzuki,hyundai',
    description: 'Comma-separated make slugs',
  })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(SLUG, { each: true })
  make?: string[];

  @ApiPropertyOptional({ example: 'swift,baleno', description: 'Comma-separated model slugs' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(SLUG, { each: true })
  model?: string[];

  @ApiPropertyOptional({ example: 'petrol,cng' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(FUEL_TYPES, { each: true })
  fuel?: FuelType[];

  @ApiPropertyOptional({ enum: TRANSMISSIONS })
  @IsOptional()
  @IsIn(TRANSMISSIONS)
  transmission?: Transmission;

  @ApiPropertyOptional({ example: 'suv,sedan' })
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(BODY_TYPES, { each: true })
  body?: BodyType[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1980)
  @Max(2100)
  minYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1980)
  @Max(2100)
  maxYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  maxKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(10)
  maxOwners?: number;

  @ApiPropertyOptional({ description: 'Latitude for radius search (requires lng and radiusKm)' })
  @ValidateIf((o: SearchListingsDto) => o.lng !== undefined || o.radiusKm !== undefined)
  @Transform(toNumber)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @ValidateIf((o: SearchListingsDto) => o.lat !== undefined || o.radiusKm !== undefined)
  @Transform(toNumber)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500 })
  @ValidateIf((o: SearchListingsDto) => o.lat !== undefined || o.lng !== undefined)
  @Transform(toNumber)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ enum: ListingSort, default: ListingSort.Newest })
  @IsOptional()
  @IsEnum(ListingSort)
  sort: ListingSort = ListingSort.Newest;
}

export class MyListingsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsIn(Object.values(ListingStatus).filter((s) => s !== ListingStatus.Deleted))
  status?: ListingStatus;
}

export class RejectListingDto {
  @ApiProperty({ example: 'Photos do not match the listed car' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
