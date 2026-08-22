import { Router } from 'express';
import multer from 'multer';
import {
  scheduleEmails,
  parseCsv,
  getScheduledEmails,
  getSentEmails,
  getEmailById,
  getEmailStats,
} from '../controllers/emailController';
import { authMiddleware } from '../middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

router.post('/schedule', scheduleEmails);

router.post('/parse-csv', upload.single('file'), parseCsv);

router.get('/stats', getEmailStats);

router.get('/scheduled', getScheduledEmails);

router.get('/sent', getSentEmails);

router.get('/:id', getEmailById);

export default router;
