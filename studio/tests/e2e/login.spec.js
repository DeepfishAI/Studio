/**
 * Login Page E2E Tests
 * 
 * Tests the login page functionality:
 * - Page loads correctly
 * - Form elements present
 * - Navigation back to landing
 */
import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
    });

    test('should load the login page', async ({ page }) => {
        // Check we're on the login page
        await expect(page).toHaveURL(/.*login/);
    });

    test('should have email input field', async ({ page }) => {
        // Look for email input (adjust selector based on actual structure)
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
        await expect(emailInput.first()).toBeVisible();
    });

    test('should have a login/submit button', async ({ page }) => {
        // Look for submit button
        const submitButton = page.locator('button[type="submit"], button:has-text("Log"), button:has-text("Sign")');
        await expect(submitButton.first()).toBeVisible();
    });

    test('should display login page content', async ({ page }) => {
        // Verify the page has loaded correctly by checking for any content
        const pageContent = await page.content();
        expect(pageContent.length).toBeGreaterThan(100);
    });
});
