import { z } from 'zod';

export const CurrencyStateSchema = z.object({
  currency: z.string().default('USD'),
});
export type CurrencyState = z.infer<typeof CurrencyStateSchema>;
