import { expect, test } from '@playwright/test';
import { device } from './helpers';

// Not isolated: these tests talk to the throwaway local sync server (see serve.mjs).
test.describe('sync between devices', () => {
  test('reviews made on one device appear on another', async ({ browser }) => {
    const name = `Sync test ${Date.now()}`;
    const laptop = await device(browser);
    await laptop.page.goto('/library?new=course');
    const dialog = laptop.page.getByRole('dialog', { name: 'New course' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('button', { name: 'Create course' }).click();
    await laptop.page.getByRole('button', { name: 'Add a topic' }).click();
    await laptop.page.getByRole('dialog').getByLabel('Name').fill('Topic');
    await laptop.page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await laptop.page.getByRole('button', { name: 'New item' }).click();
    await laptop.page.getByLabel('Question').fill(`Sum of a geometric series? (${name})`);
    await laptop.page.getByLabel('Answer').fill('$\\frac{a}{1-r}$ for $|r|<1$');
    await laptop.page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(laptop.page).toHaveURL(/\/library\?topic=/);
    await expect(laptop.page.getByText(`Sum of a geometric series? (${name})`)).toBeVisible();

    await laptop.page.goto('/settings#sync');
    await laptop.page.getByRole('button', { name: 'Sync now' }).click();
    await expect(laptop.page.getByText(/Cloud sync · Synced/)).toBeVisible();
    await expect(laptop.page.getByText('0 local changes pending')).toBeVisible();

    const phone = await device(browser);
    await phone.page.goto('/');
    await expect(phone.page.getByRole('link', { name })).toBeVisible({ timeout: 15_000 });

    await laptop.context.close();
    await phone.context.close();
  });
});
