import { AppraisalRating } from '../../../generated/prisma-client';

/** Parse a YYYY-MM-DD string to a UTC-midnight Date (matches @db.Date columns). */
export function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function todayUtc(): Date {
  return parseDate(new Date().toISOString());
}

export function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Inclusive calendar-day count between two dates (0 when the range is invalid). */
export function inclusiveDays(from: Date, to: Date): number {
  const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return diff > 0 ? diff : 0;
}

/** Rating bands: >=4.5 Outstanding, >=3.8 Exceeds, >=3.0 Meets, else Needs Improvement. */
export function ratingFor(score: number): AppraisalRating {
  if (score >= 4.5) return AppraisalRating.OUTSTANDING;
  if (score >= 3.8) return AppraisalRating.EXCEEDS_EXPECTATIONS;
  if (score >= 3) return AppraisalRating.MEETS_EXPECTATIONS;
  return AppraisalRating.NEEDS_IMPROVEMENT;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
