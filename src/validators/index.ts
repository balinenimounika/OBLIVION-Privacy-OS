/**
 * OBLIVION - Common Request Validators & Middleware Helper
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodType } from 'zod';

export function validateRequest(schema: {
  body?: ZodType<any>;
  query?: ZodType<any>;
  params?: ZodType<any>;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        const parsed = await schema.query.parseAsync(req.query);
        for (const key of Object.keys(req.query)) {
          delete (req.query as any)[key];
        }
        Object.assign(req.query, parsed);
        (req as any).validatedQuery = parsed;
      }
      if (schema.params) {
        const parsed = await schema.params.parseAsync(req.params);
        for (const key of Object.keys(req.params)) {
          delete (req.params as any)[key];
        }
        Object.assign(req.params, parsed);
        (req as any).validatedParams = parsed;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const paginationQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
  limit: z.string().optional().transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
