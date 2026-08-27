import { test, expect } from '@playwright/test';

test.describe('Sessions list', () => {
  test('create and delete a session', async ({ page }) => {
    await page.goto('/#/sessions');
    await expect(page.getByText('No sessions yet.')).toBeVisible();

    await page.getByRole('button', { name: 'New Session' }).click();
    await expect(page).toHaveURL(/#\/session\/[^/]+$/);

    await page.goto('/#/sessions');
    await expect(page.getByText('Untitled Session')).toBeVisible();
    await expect(page.getByText('0 bills · 0 people')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No sessions yet.')).toBeVisible();
  });

  test('export then import a session round-trips it', async ({ page }) => {
    await page.goto('/#/sessions');
    await page.getByRole('button', { name: 'New Session' }).click();
    const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

    // Add a person and a bill so the export isn't empty (people live on the
    // shared, session-scoped pool, added from this session home page).
    await page.getByPlaceholder('Enter name').fill('Alice');
    await page.getByPlaceholder('Enter name').press('Enter');
    await expect(page.getByText('Alice')).toBeVisible();
    await page.getByRole('button', { name: 'Add Bill' }).click();
    await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));

    await page.goto('/#/sessions');
    await expect(page.getByText('1 bill · 1 people')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    const exportPath = await download.path();
    expect(exportPath).toBeTruthy();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No sessions yet.')).toBeVisible();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import Session' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(exportPath!);

    await expect(page.getByText('Session imported successfully!')).toBeVisible();
    await expect(page.getByText('1 bill · 1 people')).toBeVisible();
  });

  test('importing a malformed (non-JSON) file surfaces the parse error', async ({ page }) => {
    await page.goto('/#/sessions');
    await page.setInputFiles('input[type="file"]', {
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not json'),
    });
    await expect(page.getByText(/not valid JSON/i)).toBeVisible();
  });

  test('importing well-formed JSON that is not session-shaped is rejected', async ({ page }) => {
    await page.goto('/#/sessions');
    await page.setInputFiles('input[type="file"]', {
      name: 'not-a-session.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
    });
    await expect(page.getByText('Invalid session data format')).toBeVisible();
  });

  test('importing an old pre-session export gives a distinguishing error', async ({ page }) => {
    await page.goto('/#/sessions');
    const oldExport = JSON.stringify({
      version: '1.1.0',
      bills: [{ id: 'A', title: 'Old bill', date: '2025-01-01T00:00:00.000Z', data: {}, isCurrent: true, version: '1.1.0' }],
      exportDate: '2025-01-01T00:00:00.000Z',
    });
    await page.setInputFiles('input[type="file"]', {
      name: 'old-export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(oldExport),
    });
    await expect(page.getByText(/old bill-history export/i)).toBeVisible();
  });
});
