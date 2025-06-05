import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.config';
import scrapeRoutes from './routes/scrape.routes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', scrapeRoutes);

// Connect to DB
connectDB();

export default app;