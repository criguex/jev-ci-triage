import { defineConfig } from '@playwright/test';

const external = process.env.BASE_URL;
const port = Number(process.env.DEMO_PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  timeout: 8_000,
  expect: { timeout: 2_000 },
  retries: 1,
  workers: 4,
  fullyParallel: true,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.DEMO_JSON_OUT ?? '.results/results.json' }],
    ['junit', { outputFile: process.env.DEMO_JUNIT_OUT ?? '.results/results.xml' }],
  ],
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: 'off',
  },
  webServer: external
    ? undefined
    : {
        command: 'node server.mjs',
        url: `http://localhost:${port}/api/health`,
        reuseExistingServer: false,
        env: { DEMO_SCENARIO: process.env.DEMO_SCENARIO ?? 'baseline', DEMO_PORT: String(port) },
      },
});
