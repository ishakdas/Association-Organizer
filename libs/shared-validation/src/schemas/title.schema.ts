import { z } from 'zod';

export const titleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number().int(),
});
export type TitleResponse = z.infer<typeof titleResponseSchema>;
