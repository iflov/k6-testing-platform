export const sanitizeString = (str: unknown): string => {
  if (typeof str !== 'string') return '';
  
  // Remove potential script injection patterns
  return str
    .replace(/[<>]/g, '')           // Remove HTML brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/`/g, "'")              // Replace backticks
    .substring(0, 10000);            // Limit length
};