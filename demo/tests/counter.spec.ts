import { expect, test } from '@playwright/test';
import { addTodos } from './support';

test('counter reflects a completed item right away', async ({ page }) => {
  await page.goto('./');
  await addTodos(page, ['buy some cheese', 'feed the cat', 'book a doctors appointment']);
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).first().check();
  await page.waitForTimeout(120);
  expect(await page.getByTestId('todo-count').textContent()).toBe('2 items left');
});
