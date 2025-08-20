// Duration parsing
type TimeUnit = 's' | 'm' | 'h';

export const parseDuration = (duration: string): number => {
  const match = duration.match(/^(\d+)([smh])$/);
  if (!match) return 30; // Default to 30 seconds

  const value = parseInt(match[1]);
  const unit = match[2] as TimeUnit;
  const unitMultipliers: Record<TimeUnit, number> = {
    s: 1,
    m: 60,
    h: 3600,
  };

  return value * unitMultipliers[unit];
};

// Duration formatting
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

export const parseTimeString = (timeStr: string): number => {
  // Parse time strings like "5m30.0s", "30s", "1h5m30s"
  if (!timeStr) return 0;

  let totalSeconds = 0;

  // Hours
  const hourMatch = timeStr.match(/(\d+)h/);
  if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;

  // Minutes
  const minMatch = timeStr.match(/(\d+)m/);
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;

  // Seconds
  const secMatch = timeStr.match(/(\d+(?:\.\d+)?)s/);
  if (secMatch) totalSeconds += parseFloat(secMatch[1]);

  return totalSeconds;
};
