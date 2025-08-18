import _ from 'lodash';

export const maskUrl = (url: string) => {
  if (_.isEmpty(url) || _.isNil(url) || url === '') {
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
