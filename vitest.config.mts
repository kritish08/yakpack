import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      // Matches the tsconfig path mapping, so tests import modules exactly the
      // way the app does.
      '@': path.resolve(import.meta.dirname, './'),
      // `server-only` exists to throw if a module is pulled into a client
      // bundle. Under Vitest there is no bundle, and letting it throw would make
      // every server module untestable — which is how security code ends up with
      // no tests at all.
      'server-only': path.resolve(import.meta.dirname, './tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // These are pure-logic tests; nothing here reaches the network. A test that
    // quietly depends on Open-Meteo being up is a test that fails on a train.
    testTimeout: 5_000,
  },
})
