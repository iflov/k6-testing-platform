export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

export const isValidUrlPath = (path: string): boolean => {
  // Check if it's a valid URL path (starts with /)
  return typeof path === 'string' && (path === '' || path.startsWith('/'));
};