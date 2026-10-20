import { expect, test } from '@playwright/test';
import {
  answerCards,
  createCourse,
  expectAccessible,
  installDeck,
  isMobile,
  isolate,
  settle,
  shot,
} from './helpers';

test.describe('study sessions', () => {
  test.beforeEach(async ({ page }) => isolate(page));

  test('install the Calculus 2 deck, study with undo, and see progress', async ({ page }) => {
    await installDeck(page);
    // New local changes count as unsynced at once (what the periodic sync waits for).
    await expect(page.getByRole('link', { name: /Offline · \d+ unsynced/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calculus 2' })).toBeVisible();
    await shot(page, 'dashboard');
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Start studying' }).click();
    await expect(page).toHaveURL(/\/study/);
    await expect(page.getByRole('article', { name: 'Question' })).toBeVisible();
    await shot(page, 'study-question');
    await expectAccessible(page);

    await answerCards(page, 1, [3]);
    // Reveal the next one to capture the answer side with interval hints.
    if (isMobile()) await page.getByRole('button', { name: 'Show answer' }).click();
    else await page.keyboard.press('Space');
    await expect(
      page.getByRole('button', { name: /^Good — Recalled; next review in/ }),
    ).toBeVisible();
    await shot(page, 'study-answer');
    await expectAccessible(page);
    await page.getByRole('button', { name: /^Again/ }).click();
    await expect(page.getByRole('group', { name: 'How well did you recall it?' })).toBeHidden();

    await answerCards(page, 6, [3, 1, 4, 2]);

    await page.getByRole('button', { name: 'Undo (U)' }).click();
    await expect(page.getByText('Rating undone')).toBeVisible();

    // Edit the current item from inside the session.
    await page.getByRole('button', { name: 'Edit item (E)' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit item' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Edit item' })).toBeHidden();

    await page.getByRole('button', { name: 'End session (Esc)' }).click();
    await expect(page).toHaveURL(/\/$/);
    // 8 answered, 1 undone.
    await expect(
      page.locator('dt', { hasText: 'Reviewed' }).locator('xpath=following-sibling::dd'),
    ).toHaveText('7');

    // Data survives a reload (IndexedDB).
    await page.reload();
    await expect(
      page.locator('dt', { hasText: 'Reviewed' }).locator('xpath=following-sibling::dd'),
    ).toHaveText('7');
  });

  test('a learning card due later today is announced, then offered once it comes due', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-14T10:00:00') });
    await page.goto('/settings');
    const steps = page.getByLabel('Learning steps', { exact: true });
    await steps.fill('1h');
    await steps.blur();
    await createCourse(page, 'Logic', 'Connectives');
    await page.getByRole('button', { name: 'New item' }).click();
    await page.getByLabel('Question').fill('What is ¬(p ∧ q)?');
    await page.getByLabel('Answer').fill('¬p ∨ ¬q');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page).toHaveURL(/\/library\?topic=/);

    await page.goto('/');
    await page.getByRole('button', { name: 'Start studying' }).click();
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page
      .getByRole('group', { name: 'How well did you recall it?' })
      .getByRole('button', { name: /^Again/ })
      .click();
    await page.getByRole('button', { name: 'Back to Today' }).click();
    // Due in an hour, beyond learn-ahead: not counted as studyable yet.
    await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
    await expect(page.getByText(/Your next card is due at 11:00/)).toBeVisible();
    // Within 20 minutes of due, the dashboard offers it without a reload, and the session has it.
    await page.clock.runFor('41:00');
    await page.getByRole('button', { name: 'Start studying' }).click();
    const question = page.getByRole('article', { name: 'Question' });
    await expect(question).toBeVisible();

    // Suspending the last card ends the session; Undo brings the card back into it.
    await page.getByRole('button', { name: 'Suspend card (S)' }).click();
    await expect(page.getByRole('heading', { name: 'Nothing due right now' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(question).toBeVisible();
  });

  test('draw an answer, then compare it with the key', async ({ page }) => {
    await installDeck(page);
    await page.getByRole('button', { name: 'Start studying' }).click();
    await expect(page.getByRole('article', { name: 'Question' })).toBeVisible();

    const draw = page.getByRole('button', { name: /^Draw/ });
    await draw.click();
    await expect(draw).toHaveAttribute('aria-pressed', 'true');
    const pad = page.getByRole('img', { name: /^Drawing pad/ });
    await expect(pad).toHaveAccessibleName('Drawing pad, empty');

    await settle(page);
    const box = await pad.boundingBox();
    const footer = await page.locator('footer').boundingBox();
    if (!box || !footer) throw new Error('pad or footer not laid out');
    // The pad fills the screen down to the footer: no dead space before checking the answer.
    expect(footer.y - (box.y + box.height)).toBeGreaterThanOrEqual(16);
    expect(footer.y - (box.y + box.height)).toBeLessThanOrEqual(32);
    expect(box.height).toBeGreaterThanOrEqual(240);
    const stroke = async (from: [number, number], to: [number, number]) => {
      await page.mouse.move(box.x + from[0], box.y + from[1]);
      await page.mouse.down();
      await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 12 });
      await page.mouse.up();
    };
    // A tall stroke spanning the pad, then a short one that gets undone.
    await stroke([40, 20], [90, box.height - 20]);
    await stroke([60, 140], [200, 60]);
    await expect(pad).toHaveAccessibleName('Drawing pad, 2 strokes drawn');
    await page.getByRole('button', { name: 'Undo last stroke' }).click();
    await expect(pad).toHaveAccessibleName('Drawing pad, 1 stroke drawn');
    await shot(page, 'study-draw');
    await expectAccessible(page);

    await page.getByRole('button', { name: /^Check answer/ }).click();
    const drawing = page.getByRole('img', { name: 'Your drawing' });
    await expect(drawing).toBeVisible();
    await expect(drawing.locator('path')).toHaveCount(1);
    // The key comes first, above the rating buttons; a big drawing below it is scaled down.
    await settle(page);
    const drawingBox = await drawing.boundingBox();
    const answerBox = await page.getByRole('region', { name: 'Answer' }).boundingBox();
    const ratingBar = await page.locator('footer').boundingBox();
    if (!drawingBox || !answerBox || !ratingBar) throw new Error('answer not laid out');
    expect(drawingBox.height).toBeLessThanOrEqual(160);
    expect(answerBox.y + answerBox.height).toBeLessThanOrEqual(ratingBar.y);
    expect(drawingBox.y).toBeGreaterThan(answerBox.y + answerBox.height);
    await shot(page, 'study-draw-answer');

    await page.getByRole('button', { name: /^Good/ }).click();
    // Draw mode persists; the next card starts with a blank pad.
    await expect(page.getByRole('img', { name: 'Drawing pad, empty' })).toBeVisible();
  });
});
