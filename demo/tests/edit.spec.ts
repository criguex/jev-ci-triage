import { expect, test } from '@playwright/test';
import { addTodos, scenario } from './support';

test('renaming a todo keeps its position', async ({ page }) => {
  test.skip(scenario !== 'candidate' && !process.env.BASE_URL, 'test added in the candidate change');
  await page.goto('./');
  await addTodos(page, ['buy some cheese', 'feed the cat']);
  await page.getByTestId('todo-title').first().dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit' });
  await editor.fill('buy goat cheese');
  await editor.press('Enter');
  await expect(page.getByTestId('todo-title')).toHaveText(['buy goat cheese', 'feed the cat']);
});
