export const isValidDuration = (duration: string): boolean => {
  return /^[1-9]\d*[smh]$/.test(duration);
};