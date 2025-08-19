// String sanitization
export const sanitizeString = (str: unknown): string => {
  if (typeof str !== 'string') return '';
  
  // Remove potential script injection patterns
  return str
    .replace(/[<>]/g, '')           // Remove HTML brackets
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/`/g, "'")              // Replace backticks
    .substring(0, 10000);            // Limit length
};

// URL masking for security
export const maskUrl = (url: string): string => {
  if (!url || url.trim() === '') {
    throw new Error('URL is required');
  }

  if (process.env.NODE_ENV === 'development') {
    // 개발 환경에서는 전체 URL 표시
    return url;
  }

  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//*****${urlObj.pathname}`;
  } catch {
    return '*****';
  }
};