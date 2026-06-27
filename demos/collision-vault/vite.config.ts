import { defineConfig } from 'vitest/config';

// GitHub Pages serves this demo from /crypto-lab-collision-vault/.
// The Vite base must match so bundled pair assets resolve at runtime.
export default defineConfig({
  base: '/crypto-lab-collision-vault/',
  worker: {
    format: 'es'
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts']
  }
});
