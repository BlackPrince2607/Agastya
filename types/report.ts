export type InsightTone = 'reveal' | 'pattern' | 'forecast';

export type InsightSection = {
  id: string;
  title: string;
  body: string;
  tone?: InsightTone;
};

export type MetricKey = 'love' | 'career' | 'money' | 'growth';

export type LifeMetrics = Record<MetricKey, number>;

export type AuraProfile = {
  label: string;
  /** LinearGradient color stops */
  gradient: readonly string[];
};

export type SimulatedReading = {
  /** Stitch: “Your Life Blueprint” hero */
  blueprintTitle: string;
  visionaryTitle: string;
  visionarySubtitle: string;
  archetypeLine: string;
  headline: string;
  sections: InsightSection[];
  boldPrediction: string;
  metrics: LifeMetrics;
  aura: AuraProfile;
};
