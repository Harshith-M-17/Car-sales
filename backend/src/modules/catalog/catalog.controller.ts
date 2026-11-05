import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'Makes/models, cities, states, features and enum values' })
  get(@Headers('if-none-match') ifNoneMatch: string | undefined, @Res() res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.setHeader('ETag', this.catalog.etag);
    if (ifNoneMatch === this.catalog.etag) {
      res.status(304).end();
      return;
    }
    res.type('application/json').send(this.catalog.json);
  }
}
