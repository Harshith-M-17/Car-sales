import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    // isValidObjectId also accepts 12-char strings; require the canonical 24-hex form.
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value) || !isValidObjectId(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  }
}
