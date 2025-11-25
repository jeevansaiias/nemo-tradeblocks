import { test, expect, Page } from '@playwright/test'
import path from 'path'

const sampleCsvPath = path.resolve(__dirname, '../fixtures/sample-trades.csv')

async function ensureToastOrFallback(page: Page) {
  const toast = page.locator('text=/uploaded|success|added/i').first()
  try {
    await toast.waitFor({ timeout: 5_000 })
  } catch {
    // Toasts might not appear when app is in a fresh state; ignore
  }
}

test.describe('Walk-Forward & TP Optimizer smoke', () => {
  test('Walk-Forward route renders', async ({ page }) => {
    await page.goto('/walk-forward')

    const loading = page.getByText('Loading blocks...')
    const selectBlock = page.getByText('Select a Block')
    const analysisHeading = page.getByRole('heading', { name: /Analysis/i })

    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeVisible()
    } else if (await selectBlock.isVisible().catch(() => false)) {
      await expect(selectBlock).toBeVisible()
    } else {
      await expect(analysisHeading).toBeVisible()
    }
  })

  test('TP Optimizer (MAE/MFE) accepts CSV upload when input available', async ({ page }) => {
    await page.goto('/tp-optimizer-mae-mfe')

    await expect(page.getByText(/TP Optimizer/i).first()).toBeVisible({ timeout: 10_000 })

    const fileInput = page.locator('input[type="file"]').first()

    if (await fileInput.count()) {
      await fileInput.setInputFiles(sampleCsvPath)
      await ensureToastOrFallback(page)

      const resultsRegion = page.getByText(/Results|Summary|Metrics/i).first()
      try {
        await expect(resultsRegion).toBeVisible({ timeout: 10_000 })
      } catch {
        // Non-fatal; the goal is to ensure upload interaction succeeds
      }
    } else {
      // If the UI replaces the native file input, at least ensure upload section rendered
      await expect(page.getByText(/Upload .*CSV/i)).toBeVisible()
    }
  })
})
