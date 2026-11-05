import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import { AuthUser, Role } from '../../common/types/auth';
import { MediaService } from './media.service';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Upload up to 10 images; returns ids to pass as `imageIds` when creating/updating a listing. */
  @Roles(Role.Seller)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      // Memory storage (multer default): files go straight to sharp, never touching disk.
      limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 5 },
      fileFilter: (_req, file, cb) =>
        ALLOWED_MIME.has(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException('Supported image formats: JPEG, PNG, WebP, AVIF'), false),
    }),
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFiles() files: Express.Multer.File[]) {
    return this.media.uploadImages(new Types.ObjectId(user.id), files);
  }
}
