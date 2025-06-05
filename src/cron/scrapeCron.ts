import cron from 'node-cron';
import { fetchAndPredict, scrapeResults, savePredictionsToDatabase, PredictionResult } from '../services/scrape.service';
import { cacheData } from '../utils/redis.util';

// Store weekly predictions
const weeklyPredictions: PredictionResult[] = [];

// ✅ Scrape latest results every 6 hours
const scrapeTask = cron.schedule('0 */6 * * *', async () => {
    try {
        const results = await scrapeResults();
        await cacheData('latestResults', results);
    } catch (error) {
        console.error('Error scraping results:', error);
    }
});

// ✅ Predict at 6 AM & 1:30 PM based on draw schedule
const predictionTask = cron.schedule('0 6,13 * * *', async () => {
    try {
        const prediction = await fetchAndPredict();
        weeklyPredictions.push(prediction);

        // Save to Database Weekly (every Sunday)
        if (weeklyPredictions.length >= 14) {
            await savePredictionsToDatabase(weeklyPredictions);
            weeklyPredictions.length = 0;
        }
    } catch (error) {
        console.error('Error during prediction task:', error);
    }
});

console.log('Cron jobs started.');
export { scrapeTask, predictionTask };
