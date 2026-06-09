export type PredictionPeriod = 'month' | '3month' | 'year';

export type PredictionCategory = 'career' | 'love' | 'money' | 'growth';

export type PredictionItem = {
  category: PredictionCategory;
  headline: string;
  detail: string;
  /** 0–100 confidence/intensity */
  score: number;
};

export type PredictionsResponse = {
  period: PredictionPeriod;
  items: PredictionItem[];
  generatedAt: string;
};

export type PredictionsByPeriod = Record<PredictionPeriod, PredictionsResponse>;

export const PREDICTION_PERIODS: { id: PredictionPeriod; label: string }[] = [
  { id: 'month', label: 'This Month' },
  { id: '3month', label: '3 Months' },
  { id: 'year', label: '1 Year' },
];
