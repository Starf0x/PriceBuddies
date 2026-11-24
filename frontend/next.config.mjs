import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Docker build: self-contained server, and /backend/* is proxied to the Express API inside the container.
const docker = process.env.DOCKER_BUILD === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  ...(docker && {
    output: 'standalone',
    async rewrites() {
      return [{ source: '/backend/:path*', destination: 'http://127.0.0.1:5001/:path*' }];
    },
  }),
};

export default nextConfig;
