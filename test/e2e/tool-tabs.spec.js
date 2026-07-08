import { test, expect } from '@playwright/test';

test.describe('Socket tool tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#tool-tabs button');
  });

  test('renders six manifest-driven tabs with correct enabled state', async ({ page }) => {
    await expect(page.locator('#tool-tabs button')).toHaveCount(6);

    for (const id of ['youtube', 'transcriber', 'markdown', 'obsidian']) {
      await expect(page.locator(`#tab-${id}`)).toBeEnabled();
    }

    for (const id of ['browser', 'oracle']) {
      const tab = page.locator(`#tab-${id}`);
      await expect(tab).toBeDisabled();
      await expect(tab).toHaveClass(/unavailable/);
    }
  });

  test('links tabs to panels with aria-controls and aria-selected', async ({ page }) => {
    await expect(page.locator('#tab-youtube')).toHaveAttribute('aria-controls', 'panel-youtube');
    await expect(page.locator('#tab-youtube')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-youtube')).toBeVisible();
    await expect(page.locator('#panel-transcriber')).toBeHidden();
  });

  test('switches tabs and preserves entered values', async ({ page }) => {
    await page.fill('#url', 'https://example.com/watch?v=ui-preserve');
    await page.click('#tab-obsidian');
    await page.fill('#vaultPath', '/tmp/socket-ui-preserve');
    await page.fill('#transcriptFolder', 'Socket/Transcripts/YouTube');
    await page.click('#tab-youtube');

    await expect(page.locator('#url')).toHaveValue(/ui-preserve/);
    await expect(page.locator('#vaultPath')).toHaveValue('/tmp/socket-ui-preserve');
  });

  test('rejects malformed URL via checkValidity without starting workflow', async ({ page }) => {
    const workflowRequests = [];
    await page.route('**/api/workflows/transcript', async (route) => {
      workflowRequests.push(route.request().method());
      await route.abort();
    });
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          defaults: {
            obsidian: {
              vaultPath: '/tmp/socket-test-vault',
              transcriptFolder: 'Socket/Transcripts/YouTube',
            },
          },
        }),
      });
    });
    await page.goto('/');
    await page.waitForSelector('#tool-tabs button');
    await page.fill('#url', 'not-a-valid-url');
    await page.click('#tab-obsidian');
    await page.evaluate(() => document.getElementById('transcript-form').requestSubmit());

    await expect(page.locator('#active-tool-status')).toContainText('YouTube');
    await expect(page.locator('#panel-youtube')).toBeVisible();
    await expect(page.locator('#tab-youtube')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#url')).toBeFocused();
    await expect(page.locator('#status')).toHaveText('Ready');
    expect(workflowRequests).toEqual([]);
  });

  test('activates Obsidian tab when required fields are empty on submit', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false, defaults: {} }),
      });
    });
    await page.goto('/');
    await page.waitForSelector('#tool-tabs button');
    await page.fill('#url', 'https://www.youtube.com/watch?v=validation-check');
    await page.click('#tab-youtube');
    await page.evaluate(() => {
      document.getElementById('vaultPath').value = '';
      document.getElementById('transcriptFolder').value = '';
    });
    await page.click('#submit-btn');

    await expect(page.locator('#active-tool-status')).toContainText('Obsidian');
    await expect(page.locator('#panel-obsidian')).toBeVisible();
    await expect(page.locator('#obsidian-validation')).toBeVisible();
    await expect(page.locator('#status')).toHaveText('Ready');
  });

  test('supports keyboard navigation across selectable tabs', async ({ page }) => {
    await page.locator('#tab-youtube').focus();
    await expect(page.locator('#tab-youtube')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-transcriber')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-transcriber')).toBeFocused();
    await expect(page.locator('#panel-transcriber')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-markdown')).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Home');
    await expect(page.locator('#tab-youtube')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-youtube')).toBeFocused();

    await page.keyboard.press('End');
    await expect(page.locator('#tab-obsidian')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-obsidian')).toBeFocused();
  });

  test('wraps keyboard navigation across selectable tabs only', async ({ page }) => {
    await page.locator('#tab-obsidian').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-youtube')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-browser')).toBeDisabled();
    await expect(page.locator('#tab-oracle')).toBeDisabled();
  });
});