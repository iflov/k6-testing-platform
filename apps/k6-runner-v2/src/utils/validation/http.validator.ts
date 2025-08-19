export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type HttpMethod = typeof HTTP_METHODS[number];

export const isValidHttpMethod = (method: string): method is HttpMethod => {
  return HTTP_METHODS.includes(method as HttpMethod);
};