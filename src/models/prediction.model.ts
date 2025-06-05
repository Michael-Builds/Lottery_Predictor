import { Schema, model, Document } from 'mongoose';

export interface IPrediction extends Document {
    date: string;
    draw: string;
    predictedNumbers: number[];
    accuracy: number;
}

const predictionSchema = new Schema<IPrediction>({
    date: {
        type: String,
        required: true
    },
    draw: {
        type: String,
        required: true
    },
    predictedNumbers: {
        type: [Number],
        required: true
    },
    accuracy: {
        type: Number,
        required: true
    }
});

export const Prediction = model<IPrediction>('Prediction', predictionSchema);
