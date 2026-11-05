import { z } from 'zod';

export const newPasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Include a letter and a number');

/** Loose client-side check; the API normalises and strictly validates (E.164). */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{8,16}[0-9]$/, 'Enter a valid mobile number');

export const addressSchema = z.object({
  addressLine: z.string().trim().min(1, 'Enter the shop or street address').max(200),
  locality: z.string().trim().max(120),
  city: z.string().trim().min(1, 'Enter the city').max(80),
  state: z.string().min(1, 'Select the state'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit pincode'),
});
export type AddressValues = z.infer<typeof addressSchema>;

export const EMPTY_ADDRESS: AddressValues = { addressLine: '', locality: '', city: '', state: '', pincode: '' };

export const toAddressInput = (v: AddressValues) => ({
  addressLine: v.addressLine,
  locality: v.locality || undefined,
  city: v.city,
  state: v.state,
  pincode: v.pincode,
});

export const dealerSchema = addressSchema.extend({
  businessName: z.string().trim().min(1, 'Enter your dealership name').max(120),
});
export type DealerValues = z.infer<typeof dealerSchema>;

export const toDealerInput = (v: DealerValues) => ({ businessName: v.businessName, address: toAddressInput(v) });
