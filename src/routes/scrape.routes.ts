import express from 'express';
import { getResults } from '../controllers/scrape.controller';

const router = express.Router();

router.get('/scrape', getResults);

export default router;