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
    h: 3600 
  };
  
  return value * unitMultipliers[unit];
};

// Duration formatting
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};