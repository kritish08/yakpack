import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // enable standalone output for Docker self-host
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
}

export default nextConfig
