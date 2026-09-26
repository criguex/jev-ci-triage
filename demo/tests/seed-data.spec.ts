import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { scenario } from './support';

const fixture = new URL(
  scenario === 'candidate' ? './fixtures/candidate/shopping-list.json' : './fixtures/shopping-list.json',
  import.meta.url,
);
const seed = readFileSync(fixture, 'utf8');

test('seeded shopping list renders in order', async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem('react-todos', data), seed);
  await page.goto('./');
  await expect(page.getByTestId('todo-title')).toHaveText(['Milk', 'Eggs', 'Bread']);
});
