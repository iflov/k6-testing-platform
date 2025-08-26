// 문자열 정제
export const sanitizeString = (str: unknown): string => {
  if (typeof str !== 'string') return '';

  // 잠재적인 스크립트 인젝션 패턴 제거
  return (
    str
      .replace(/[<>]/g, '') // HTML 괄호 제거
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '') // 제어 문자 제거
      .replace(/`/g, "'") // 백틱 제거
      .substring(0, 10000)
  ); // 길이 제한
};

// 보안을 위한 URL 마스킹
export const maskUrl = (url: string): string => {
  if (!url || url.trim() === '') {
    throw new Error('URL is required');
  }

  if (process.env.NODE_ENV === 'development') {
    // 개발 환경에서는 전체 URL 표시 (보안 이슈 방지)
    return url;
  }

  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//*****${urlObj.pathname}`;
  } catch {
    return '*****';
  }
};
