import { Router } from 'express';
import { googleLogin, googleCallback, getCurrentUser, logout } from '../controllers/authController';
import { authMiddleware } from '../middleware';

const router = Router();

router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);

router.get('/me', authMiddleware, getCurrentUser);
router.post('/logout', authMiddleware, logout);

export default router;
