import _ from 'lodash';

export const makeUrl = (url: string) => {
  if (_.isEmpty(url) || _.isNil(url) || url === '') {
    throw new Error('URL is required');
  }

  if (process.env.NODE_ENV === 'development') {
    // 개발 환경에서는 전체 URL 표시
    return url;
  }

  try {
    const u = new URL(url);
    return `${u.protocol}//*****${u.pathname}`;
  } catch {
    return '*****';
  }
};
