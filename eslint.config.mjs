import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

// Flat config. `next lint` was removed in Next 16, so ESLint is invoked
// directly via `pnpm lint` and runs in CI alongside type-check.
//
// Note: eslint is pinned to ^9 — eslint-plugin-react 7.37.x (pulled in by
// eslint-config-next) still calls context.getFilename(), which ESLint 10 removed.
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/sw.js', // plain service-worker script, not part of the app graph
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // React Compiler diagnostics, kept visible but non-blocking.
      //
      // Every current hit is the deliberate "sync server props / localStorage
      // into local state" pattern (theme-toggle's mounted flag, the screens'
      // re-sync after router.refresh, the offline outbox projection). Reading
      // localStorage during render instead would trip hydration mismatches, so
      // the effect is the correct place. Demoted rather than disabled so genuinely
      // new violations still surface in review.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]

export default config
