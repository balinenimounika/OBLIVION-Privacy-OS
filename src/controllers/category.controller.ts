/**
 * OBLIVION - Data Category Controller
 */

import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/category.service';
import { ApiResponse } from '../utils/api-response';

export class CategoryController {
  /**
   * GET /api/v1/categories
   * Lists reference data categories.
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const categories = await CategoryService.getCategories(query);
      ApiResponse.success(res, 'Data categories retrieved successfully', categories, 200, {
        total: categories.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/categories/:id
   * Retrieves single reference category by ID.
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const category = await CategoryService.getCategoryById(id);
      ApiResponse.success(res, 'Data category retrieved successfully', category);
    } catch (error) {
      next(error);
    }
  }
}
