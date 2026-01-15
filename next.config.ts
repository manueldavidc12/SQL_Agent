import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize packages that don't work well with bundling
  serverExternalPackages: ['just-bash', 'bash-tool', '@mongodb-js/zstd'],

  // Add empty turbopack config to silence warning about webpack config
  turbopack: {
    resolveAlias: {
      // Alias problematic packages if needed
    },
  },

  // Webpack configuration as fallback
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these packages on the server
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          'just-bash': 'commonjs just-bash',
          'bash-tool': 'commonjs bash-tool',
        });
      }
    }
    return config;
  },
};

export default nextConfig;
