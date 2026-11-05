import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { decodeCursor, encodeCursor, keysetConditions, toCursorPage, withCursor } from './cursor';

describe('cursor pagination', () => {
  const id = new Types.ObjectId();

  it('round-trips numbers, strings and dates', () => {
    for (const value of [550000, 'abc', new Date('2026-01-02T03:04:05.000Z')]) {
      const decoded = decodeCursor(encodeCursor(value, id));
      expect(decoded.id.equals(id)).toBe(true);
      expect(decoded.value).toEqual(value);
    }
  });

  it('rejects tampered cursors', () => {
    const bad = [
      'not-base64-json',
      Buffer.from('{"a":1}').toString('base64url'),
      Buffer.from('[1,"zzz"]').toString('base64url'),
      Buffer.from('[{"$gt":1},"' + id.toHexString() + '"]').toString('base64url'),
    ];
    for (const cursor of bad) expect(() => decodeCursor(cursor)).toThrow(BadRequestException);
  });

  it('builds an index-friendly range plus tie-breaker', () => {
    const cursor = encodeCursor(500000, id);
    expect(keysetConditions({ field: 'price', direction: 1 }, cursor)).toEqual([
      { price: { $gte: 500000 } },
      { $or: [{ price: { $gt: 500000 } }, { _id: { $gt: id } }] },
    ]);
    expect(keysetConditions({ field: 'price', direction: -1 }, cursor)[0]).toEqual({
      price: { $lte: 500000 },
    });
  });

  it('merges into existing $and and leaves the filter alone without a cursor', () => {
    const filter = { status: 'active', $and: [{ a: 1 }] };
    expect(withCursor(filter, { field: 'price', direction: 1 }, undefined)).toBe(filter);
    const merged = withCursor(filter, { field: 'price', direction: 1 }, encodeCursor(1, id));
    expect(merged.$and).toHaveLength(3);
    expect(merged.status).toBe('active');
  });

  it('uses the extra row only to detect a next page', () => {
    const docs = [1, 2, 3].map((n) => ({ _id: new Types.ObjectId(), price: n }));
    const page = toCursorPage(docs, 2, { field: 'price', direction: 1 }, (d) => d.price);
    expect(page.items).toEqual([1, 2]);
    expect(decodeCursor(page.nextCursor!).value).toBe(2);
    expect(
      toCursorPage(docs.slice(0, 2), 2, { field: 'price', direction: 1 }, (d) => d).nextCursor,
    ).toBeNull();
  });
});
