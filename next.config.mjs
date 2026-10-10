/** @type {import('next').NextConfig} */
const nextConfig = {
  // 优化编译和加载性能
  // 启用 SWC 的 minify 来加快编译
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 优化图片加载
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // 优化性能
  experimental: {
    // 优化字体加载
    optimizePackageImports: ['recharts', 'lucide-react', 'antd'],
    // 启用并行路由预加载
    optimisticClientCache: true,
  },

  // 优化打包
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 优化客户端打包
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // 第三方库单独打包
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // 公共组件单独打包
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
