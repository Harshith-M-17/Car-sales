import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [ListingsModule, UsersModule],
  controllers: [AdminController],
})
export class AdminModule {}
