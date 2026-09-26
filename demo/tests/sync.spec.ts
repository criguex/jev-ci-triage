import { expect, test } from '@playwright/test';

const syncApi = process.env.SYNC_API_URL;

test('backup service answers its health check', async ({ request, baseURL }) => {
  test.skip(!syncApi && Boolean(process.env.BASE_URL), 'no backup service next to the public demo');
  const response = await request.get(`${syncApi ?? baseURL}/api/health`, { timeout: 3_000 });
  expect(response.ok()).toBe(true);
});
