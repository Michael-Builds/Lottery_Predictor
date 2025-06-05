import puppeteer from 'puppeteer';
import { cacheData, getCachedData } from '../utils/redis.util';
import { Prediction } from '../models/prediction.model';
import sendEmail from '../utils/sendEmail';

// Draw schedule by weekday and generation
export const dayDraws: any = {
    monday: {
        firstgeneration: { start: 6, end: 12, name: "Monday Noon Rush" },
        secondgeneration: { start: 13, end: 18, name: "Monday Special" }
    },
    tuesday: {
        firstgeneration: { start: 6, end: 12, name: "Tuesday Noon Rush" },
        secondgeneration: { start: 13, end: 18, name: "Lucky Tuesday" }
    },
    wednesday: {
        firstgeneration: { start: 6, end: 12, name: "Wednesday Noon Rush" },
        secondgeneration: { start: 13, end: 18, name: "Midweek" }
    },
    thursday: {
        firstgeneration: { start: 6, end: 12, name: "Thursday Noon Rush" },
        secondgeneration: { start: 13, end: 18, name: "Fortune Thursday" }
    },
    friday: {
        firstgeneration: { start: 6, end: 12, name: "Friday Noon Rush" },
        secondgeneration: { start: 13, end: 18, name: "Friday Bonanza" }
    },
    saturday: {
        firstgeneration: { start: 6, end: 12, name: "Saturday Noon Rush" },
        secondgeneration: { start: 13, end: 18, name: "National Weekly" }
    },
    sunday: {
        start: 6,
        end: 18,
        name: "Sunday Aseda"
    }
};

// Interfaces
interface DrawResult {
    drawId: string;
    draw: string;
    date: string;
    numbers: string;
}

interface ProcessedDrawResult {
    drawId: string;
    draw: string;
    date: string;
    numbers: number[];
}

interface NumberFrequency {
    [key: number]: number;
}

export interface PredictionResult {
    date: string;
    draw: string;
    predictedNumbers: number[];
    accuracy: number;
}

// Scraping Function
export const scrapeResults = async (): Promise<DrawResult[]> => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const results: DrawResult[] = [];

    try {
        for (let i = 1; i <= 10; i++) {
            const url = `https://www.590mobile.com.gh/results?page=${i}`;
            console.log(`Navigating to: ${url}`);

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Log the page content to see what's being loaded
            const pageContent = await page.content();
            console.log(`Page content (first 500 chars): ${pageContent.substring(0, 500)}...`);

            // Log all table rows to see what's being captured
            const tableRows = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tr');
                return Array.from(rows).map(row => row.outerHTML);
            });
            console.log(`Table rows found: ${tableRows.length}`);
            console.log(`Sample row: ${tableRows[0] || 'No rows found'}`);

            const pageResults: DrawResult[] = await page.evaluate(() => {
                const rows = document.querySelectorAll('table tr');
                const data: DrawResult[] = [];
                rows.forEach(row => {
                    const columns = row.querySelectorAll('td');
                     if (columns.length >= 4) {
                        data.push({
                            drawId: columns[0].innerText.trim(),
                            draw: columns[1].innerText.trim(),
                            date: columns[2].innerText.trim(),
                            numbers: columns[3].innerText.trim(),
                        });
                    }
                });
                return data;
            });

            console.log(`Results from page ${i}:`, pageResults);
            results.push(...pageResults);
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }

    return results;
};

// Preprocess Data
const preprocessData = (results: DrawResult[]): ProcessedDrawResult[] => {
    return results.map(result => ({
        ...result,
        numbers: result.numbers.split(',').map(Number),
    }));
};


// Function to get the current date in YYYY-MM-DD format
const getCurrentDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

// Function to get the current draw based on time
const getCurrentDraw = (): string => {
    const today = new Date();
    const day = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hour = today.getHours();

    const drawSchedule = dayDraws[day];
    if (!drawSchedule) return "Unknown Draw";

    if (hour >= drawSchedule.firstgeneration?.start && hour < drawSchedule.firstgeneration?.end) {
        return drawSchedule.firstgeneration.name;
    } else if (hour >= drawSchedule.secondgeneration?.start && hour < drawSchedule.secondgeneration?.end) {
        return drawSchedule.secondgeneration.name;
    } else {
        return "Unknown Draw";
    }
};


// Predict Next Numbers (Using Today's Date Instead of Latest Draw's Date)
const predictNumbers = (results: ProcessedDrawResult[]): PredictionResult => {
    const currentDraw = getCurrentDraw();

    // Find past draws of the same type
    const pastDraws = results.filter(result => result.draw === currentDraw);
    if (pastDraws.length === 0) {
        console.warn(`No past draws found for ${currentDraw}. Using general data.`);
    }

    const numberFrequency: NumberFrequency = {};
    pastDraws.forEach(result => {
        result.numbers.forEach(number => {
            numberFrequency[number] = (numberFrequency[number] || 0) + 1;
        });
    });

    const sortedNumbers = Object.keys(numberFrequency)
        .map(Number)
        .sort((a, b) => numberFrequency[b] - numberFrequency[a]);

    const predictedNumbers = sortedNumbers.slice(0, 5);

    return {
        date: getCurrentDate(),
        draw: currentDraw,
        predictedNumbers,
        accuracy: 0
    };
};

// Save Prediction to Redis
const savePredictionToRedis = async (prediction: PredictionResult): Promise<void> => {
    await cacheData('latestPrediction', prediction);
};

// Evaluate Model Accuracy
const evaluateModel = (results: ProcessedDrawResult[], prediction: PredictionResult): number => {
    const splitIndex = Math.floor(results.length * 0.8);
    const testingData = results.slice(splitIndex);

    let correctPredictions = 0;
    testingData.forEach(result => {
        const matches = result.numbers.filter(number => prediction.predictedNumbers.includes(number)).length;
        correctPredictions += matches;
    });

    return (correctPredictions / (testingData.length * 5)) * 100;
};

// Predict Next Numbers Using Latest Scraped Data
export const fetchAndPredict = async (): Promise<PredictionResult> => {
  try {
    // Always scrape latest results
    const scrapedResults = await scrapeResults();

    // Overwrite cache with fresh results
    await cacheData('latestResults', scrapedResults);

    const processedData = preprocessData(scrapedResults);
    const prediction = predictNumbers(processedData);
    prediction.accuracy = evaluateModel(processedData, prediction);

    // Save prediction to Redis
    await savePredictionToRedis(prediction);

    // Send prediction email
    await sendEmail({
      email: 'michaelkpantiramp@gmail.com',
      subject: `New Lottery Prediction for ${prediction.draw}`,
      template: 'prediction.ejs',
      data: {
        draw: prediction.draw,
        date: prediction.date,
        predictedNumbers: prediction.predictedNumbers,
        accuracy: prediction.accuracy,
      }
    });

    console.log("Predictions", prediction);

    return prediction;
  } catch (error) {
    console.error("Prediction error:", error);
    throw error;
  }
};


// Save Predictions to Database (Weekly)
export const savePredictionsToDatabase = async (predictions: PredictionResult[]): Promise<void> => {
    try {
        await Prediction.insertMany(predictions);
        // Send summary email
        await sendEmail({
            email: 'michaelkpantiramp@gmail.com',
            subject: 'Weekly Prediction Summary',
            template: 'prediction.ejs',
            data: {
                draw: "Weekly Summary",
                date: new Date().toISOString().split('T')[0],
                predictedNumbers: predictions.map(p => p.predictedNumbers).flat(),
                accuracy: (predictions.reduce((acc, p) => acc + p.accuracy, 0) / predictions.length).toFixed(2),
            }
        });
    } catch (error) {
        console.error('Error saving predictions to database:', error);
    }
};
