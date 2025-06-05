import { Request, Response } from 'express';
import { scrapeResults } from '../services/scrape.service';

export const getResults = async (req: Request, res: Response) => {
    try {
        const results = await scrapeResults();
        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ message: 'Error scraping data', error });
    }
};