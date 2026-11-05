import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export type SortDirection = 1 | -1;

/** Keyset sort: a primary field plus `_id` as a unique tie-breaker. */
export interface KeysetSort {
  field: string;
  direction: SortDirection;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  /** Only computed for the first page; may be capped (see `totalIsCapped`). */
  total?: number;
  totalIsCapped?: boolean;
}

type CursorValue = string | number | boolean | null | { d: string };

interface DecodedCursor {
  value: unknown;
  id: Types.ObjectId;
}

function getPath(doc: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, doc);
}

export function encodeCursor(value: unknown, id: Types.ObjectId | string): string {
  const v: CursorValue =
    value instanceof Date ? { d: value.toISOString() } : ((value as CursorValue) ?? null);
  return Buffer.from(JSON.stringify([v, String(id)]), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[1] !== 'string') {
      throw new Error('shape');
    }
    const [raw, id] = parsed as [CursorValue, string];
    if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('id');

    let value: unknown = raw;
    if (raw !== null && typeof raw === 'object') {
      if (typeof raw.d !== 'string') throw new Error('date');
      const date = new Date(raw.d);
      if (Number.isNaN(date.getTime())) throw new Error('date');
      value = date;
    } else if (!['string', 'number', 'boolean'].includes(typeof raw) && raw !== null) {
      throw new Error('value');
    }
    return { value, id: new Types.ObjectId(id) };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

/** Mongo sort spec for a keyset sort (primary field + `_id`, same direction). */
export function keysetSortSpec(sort: KeysetSort): Record<string, SortDirection> {
  return { [sort.field]: sort.direction, _id: sort.direction };
}

/**
 * Conditions selecting documents strictly after the cursor position.
 *
 * The inclusive range on the sort field gives the planner index bounds to seek to;
 * the `$or` only disambiguates ties on that one value. (A bare `$or` would be applied
 * as a residual filter, scanning every entry before the cursor.) Pages therefore cost
 * O(limit) at any depth, unlike skip/offset.
 */
export function keysetConditions(sort: KeysetSort, cursor: string): Record<string, unknown>[] {
  const { value, id } = decodeCursor(cursor);
  const strict = sort.direction === 1 ? '$gt' : '$lt';
  const inclusive = sort.direction === 1 ? '$gte' : '$lte';
  return [
    { [sort.field]: { [inclusive]: value } },
    { $or: [{ [sort.field]: { [strict]: value } }, { _id: { [strict]: id } }] },
  ];
}

/** Adds keyset conditions to a filter (top-level merge keeps `$text` at the root). */
export function withCursor<F extends Record<string, unknown>>(
  filter: F,
  sort: KeysetSort,
  cursor: string | undefined,
): F {
  if (!cursor) return filter;
  const existing = (filter.$and as Record<string, unknown>[] | undefined) ?? [];
  return { ...filter, $and: [...existing, ...keysetConditions(sort, cursor)] };
}

/**
 * Turns `limit + 1` fetched docs into a page. Fetching one extra row tells us whether
 * another page exists without running a count query.
 */
export function toCursorPage<T extends { _id: Types.ObjectId }, R>(
  docs: T[],
  limit: number,
  sort: KeysetSort,
  map: (doc: T) => R,
): CursorPage<R> {
  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  const last = pageDocs[pageDocs.length - 1];
  return {
    items: pageDocs.map(map),
    nextCursor: hasMore && last ? encodeCursor(getPath(last, sort.field), last._id) : null,
  };
}
