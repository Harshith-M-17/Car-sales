import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogModule } from '../catalog/catalog.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { BranchesController } from './branches.controller';
import { ListingViewsService } from './listing-views.service';
import { ListingsController, SellersController } from './listings.controller';
import { ListingsService } from './listings.service';
import { Listing, ListingSchema } from './schemas/listing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }]),
    UsersModule,
    MediaModule,
    CatalogModule,
    FavoritesModule,
  ],
  controllers: [ListingsController, SellersController, BranchesController],
  providers: [ListingsService, ListingViewsService],
  exports: [ListingsService],
})
export class ListingsModule {}
