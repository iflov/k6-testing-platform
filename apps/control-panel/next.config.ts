import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // TypeORM에서 사용하지 않는 드라이버들을 제외
      config.externals.push({
        'react-native-sqlite-storage': 'react-native-sqlite-storage',
        '@sap/hana-client': '@sap/hana-client',
        'mysql': 'mysql',
        'mysql2': 'mysql2',
        'oracledb': 'oracledb',
        'sqlite3': 'sqlite3',
        'tedious': 'tedious',
        'mongodb': 'mongodb',
        'react-native': 'react-native',
      });
    }

    // TypeORM의 동적 require를 처리하기 위한 설정
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
  // TypeORM entity 파일들이 빌드에서 제외되지 않도록 설정
  transpilePackages: ['typeorm'],
};

export default nextConfig;
