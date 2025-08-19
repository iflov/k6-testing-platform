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