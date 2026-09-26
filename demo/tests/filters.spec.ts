import { expect, test } from '@playwright/test';
import { addTodos } from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await addTodos(page, ['buy some cheese', 'feed the cat', 'book a doctors appointment']);
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).nth(1).check();
});

test('Active filter shows only active todos', async ({ page }) => {
  await page.getByRole('link', { name: 'Active' }).click();
  await expect(page.getByTestId('todo-title')).toHaveText(['buy some cheese', 'book a doctors appointment']);
});

test('Completed filter shows only completed todos', async ({ page }) => {
  await page.getByRole('link', { name: 'Completed' }).click();
  await expect(page.getByTestId('todo-title')).toHaveText(['feed the cat']);
});
