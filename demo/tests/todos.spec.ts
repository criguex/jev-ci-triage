import { expect, test } from '@playwright/test';
import { addTodos } from './support';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('adds todos in the order they were typed', async ({ page }) => {
  await addTodos(page, ['buy some cheese', 'feed the cat']);
  await expect(page.getByTestId('todo-title')).toHaveText(['buy some cheese', 'feed the cat']);
});

test('completing a todo strikes it through', async ({ page }) => {
  await addTodos(page, ['buy some cheese']);
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).check();
  await expect(page.getByTestId('todo-item')).toHaveClass(/completed/);
});

test('clear completed removes only completed todos', async ({ page }) => {
  await addTodos(page, ['buy some cheese', 'feed the cat', 'book a doctors appointment']);
  await page.getByRole('checkbox', { name: 'Toggle Todo' }).nth(1).check();
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await expect(page.getByTestId('todo-title')).toHaveText(['buy some cheese', 'book a doctors appointment']);
});

test('counter shows items left', async ({ page }) => {
  await addTodos(page, ['buy some cheese', 'feed the cat']);
  await expect(page.getByTestId('todo-count')).toHaveText('2 items left');
});
