import { expect, test } from '@playwright/test';
import { addTodos, runIndex } from './support';

test('marks everything complete through its accessible label', async ({ page }) => {
  test.skip(runIndex < 6, 'test introduced in run 6');
  await page.goto('./');
  await addTodos(page, ['buy some cheese', 'feed the cat']);
  await page.getByLabel('Mark all as complete').check();
  await expect(page.getByTestId('todo-item')).toHaveClass([/completed/, /completed/]);
});
