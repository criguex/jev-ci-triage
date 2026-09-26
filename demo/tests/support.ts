import type { Page } from '@playwright/test';

export const scenario = process.env.DEMO_SCENARIO ?? 'baseline';
export const runIndex = Number(process.env.DEMO_RUN ?? 99);

export async function addTodos(page: Page, titles: string[]): Promise<void> {
  const input = page.getByPlaceholder('What needs to be done?');
  for (const title of titles) {
    await input.fill(title);
    await input.press('Enter');
  }
}
