import { test, expect } from '@playwright/test'

const uniqueId = Date.now().toString()

test('successful_signup', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000/')

    // Click signup button
    await page.click('text=Sign Up')

    // Expect url to be signup
    await expect(page).toHaveURL('http://localhost:3000/signup')

    // Expect to have signup heading
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible()

    // Enter details
    await page.getByLabel('name').fill(`John Doe ${browserName}`)
    await page.click('text=Select your Entity')
    await page.getByText('Department of Agrarian Reform').nth(1).click()
    await page.getByLabel('email').fill(`test-${browserName}-${uniqueId}@dar.com`)
    await page.getByLabel('position').fill('Personnel Officer')
    await page.getByLabel('password').first().fill('T#st1234T#st1234')

    // Click signup button
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Expect URL to be login
    await expect(page).toHaveURL('http://localhost:3000/login')
})

test('unsuccessful_signup', async ({ page }) => {
    await page.goto('http://localhost:3000/')

    // Click signup button
    await page.click('text=Sign Up')

    // Expect url to be signup
    await expect(page).toHaveURL('http://localhost:3000/signup')

    // Expect to have signup heading
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible()

    // Enter details
    await page.getByLabel('name').fill('A')
    await page.click('text=Select your Entity')
    await page.getByText('Department of Agrarian Reform').nth(1).click()
    await page.getByLabel('email').fill('a@b')
    await page.getByLabel('position').fill('A')
    await page.getByLabel('password').first().fill('A')

    // Click signup button
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Expect error message
    await test.step('Expect error messages', async () => {
        await expect(page.getByText('Name must be at least 2 characters')).toBeVisible()
        await expect(page.getByText('Position must be at least 2 characters')).toBeVisible()
        await expect(page.getByText('Please enter a valid email.')).toBeVisible()
        await expect(page.getByText('Password must:')).toBeVisible()
        await expect(page.getByText('Be at least 16 characters long')).toBeVisible()
        await expect(page.getByText('Contain at least one lowercase letter')).toBeVisible()
        await expect(page.getByText('Contain at least one number')).toBeVisible()
        await expect(page.getByText('Contain at least one special character')).toBeVisible()
    })
})
