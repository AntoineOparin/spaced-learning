import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installDeck, isolate, settle } from './helpers';

test.describe('settings and backup', () => {
  test.beforeEach(async ({ page }) => isolate(page));

  test('two-digit numbers can be typed, and deep links land on their section', async ({ page }) => {
    await page.goto('/settings#backup');
    const backup = page.getByRole('heading', { name: 'Backup', exact: true });
    await expect(backup).toBeVisible();
    await settle(page);
    const top = (await backup.boundingBox())?.y ?? -1;
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(120);

    const leech = page.getByLabel('Leech threshold');
    await leech.fill('');
    await leech.pressSequentially('12');
    await leech.blur();
    await expect(leech).toHaveValue('12');
    await leech.fill('0');
    await leech.blur();
    await expect(leech).toHaveValue('5');
    await page.reload();
    await expect(page.getByLabel('Leech threshold')).toHaveValue('5');
  });

  test('export a backup, reset the device, and restore it', async ({ page }) => {
    await installDeck(page);
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const file = await (await download).path();
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    expect(backup.format).toBe('spaced-learning-backup');
    expect(backup.items.length).toBeGreaterThan(150);

    await page.getByRole('button', { name: 'Reset this device' }).click();
    const erase = page.getByRole('dialog', { name: 'Reset this device?' });
    const eraseButton = erase.getByRole('button', { name: 'Erase this device' });
    await expect(eraseButton).toBeDisabled();
    await erase.getByLabel('Type ERASE to confirm').fill('ERASE');
    await eraseButton.click();
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

    await page.goto('/settings');
    await page.locator('#backup input[type=file]').setInputFiles(file);
    const confirm = page.getByRole('dialog', { name: 'Restore this backup?' });
    await expect(confirm).toContainText(`${backup.items.length} items`);
    await confirm.getByRole('button', { name: 'Replace local data' }).click();
    await expect(page.getByText('Backup restored')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Calculus 2' })).toBeVisible();
  });
});
