import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { ImageProcessor } from './image-processor';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media, MediaSchema } from './schemas/media.schema';
import { LocalStorageDriver } from './storage/local.driver';
import { S3StorageDriver } from './storage/s3.driver';
import { STORAGE_DRIVER, StorageDriver } from './storage/storage.driver';

@Module({
  imports: [MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }])],
  controllers: [MediaController],
  providers: [
    MediaService,
    ImageProcessor,
    {
      provide: STORAGE_DRIVER,
      inject: [APP_CONFIG],
      useFactory: ({ storage }: AppConfig): StorageDriver =>
        storage.driver === 's3'
          ? new S3StorageDriver({ ...storage.s3, publicBaseUrl: storage.publicBaseUrl })
          : new LocalStorageDriver(storage.localDir, storage.publicBaseUrl),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
