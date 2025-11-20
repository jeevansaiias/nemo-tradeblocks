import { test, expect } from '@playwright/test'

test.describe('TP Optimizer & P/L Calendar smoke', () => {
  test('TP Optimizer page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/tp-optimizer')
    await expect(page.locator('text=Auto Take-Profit Optimizer')).toBeVisible({ timeout: 10000 })
  })

  test('TP Optimizer (MAE/MFE) page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/tp-optimizer-mae-mfe')
    await expect(page.locator('text=TP Optimizer (MAE/MFE Edition)')).toBeVisible({ timeout: 10000 })
  })

  test('P/L Calendar page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/calendar')
    // The calendar page shows a 'No Active Block Selected' state when no block is active,
    // otherwise it shows the P/L Calendar heading. Accept either.
    const noActive = await page.getByText('No Active Block Selected').first().isVisible().catch(() => false)
    if (noActive) {
      await expect(page.getByText('No Active Block Selected')).toBeVisible()
    } else {
      await expect(page.getByRole('heading', { name: /P\/?L Calendar/ })).toBeVisible({ timeout: 10000 })
    }
  })
})
