import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalises a phone number to E.164 (e.g. +919876543210), or null if invalid. */
export function normalizePhone(input: string, defaultRegion: string): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultRegion as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}

/** Splits `a,b,c` query values into a trimmed, de-duplicated array. */
export function splitCsv(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parts = (Array.isArray(value) ? value : String(value).split(','))
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);
  return parts.length ? [...new Set(parts)] : undefined;
}
