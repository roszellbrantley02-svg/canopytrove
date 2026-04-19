import { z } from 'zod';
import { logger } from '../observability/logger';

const brandIdSchema = z
  .string()
  .min(1, 'Brand ID is required')
  .max(255, 'Brand ID must be 255 characters or less')
  .regex(/^[a-z0-9\-]+$/, 'Brand ID must be lowercase alphanumeric and hyphens only');

const addFavoriteBrandBodySchema = z.object({
  brandId: brandIdSchema,
});

export type AddFavoriteBrandBody = z.infer<typeof addFavoriteBrandBodySchema>;

export function parseAddFavoriteBrandBody(body: unknown): AddFavoriteBrandBody {
  try {
    return addFavoriteBrandBodySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[validationFavoriteBrands] Invalid add favorite brand body', {
        errors: error.errors,
      });
      throw new Error(`Invalid request body: ${error.errors[0]?.message || 'validation failed'}`);
    }
    throw error;
  }
}

export function parseBrandIdParam(value: unknown): string {
  try {
    return brandIdSchema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[validationFavoriteBrands] Invalid brand ID param', {
        value,
        errors: error.errors,
      });
      throw new Error(`Invalid brand ID: ${error.errors[0]?.message || 'validation failed'}`);
    }
    throw error;
  }
}
