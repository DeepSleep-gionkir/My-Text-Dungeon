/** @type {import('next').NextConfig} */
const nextConfig = {
  // 워크스페이스 루트가 잘못 추론되면(PostCSS/Tailwind 포함) 스타일이 깨질 수 있어,
  // 이 프로젝트 폴더를 명시합니다.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;

