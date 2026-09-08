export type AnalyticsValue = string | number | boolean;

export interface AnalyticsAdapter {
  track(eventName: string, properties: Readonly<Record<string, AnalyticsValue>>): void;
}
