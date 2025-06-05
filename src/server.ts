import app from './app';
import { scrapeTask, predictionTask } from './cron/scrapeCron';
import { fetchAndPredict } from './services/scrape.service';

const PORT = process.env.PORT || 3000;

// Start the Express server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    scrapeTask.start();
    predictionTask.start();
});


// Fetch and predict immediately on startup
fetchAndPredict().catch(error => {
    console.error('Error during initial prediction:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Stopping cron jobs...');
    scrapeTask.stop();
    predictionTask.stop();
    server.close(() => {
        process.exit(0);
    });
});
