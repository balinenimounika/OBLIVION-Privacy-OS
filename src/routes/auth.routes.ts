/**
 * OBLIVION - Authentication Routes
 */

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import { authRateLimiter } from '../middleware/rate-limiter.middleware';
import { validateRequest } from '../validators';
import { registerSchema, loginSchema } from '../validators/auth.validator';

const router = Router();

router.post(
  '/register',
  authRateLimiter.middleware,
  validateRequest({ body: registerSchema }),
  AuthController.register
);

router.post(
  '/login',
  authRateLimiter.middleware,
  validateRequest({ body: loginSchema }),
  AuthController.login
);

router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

export default router;
