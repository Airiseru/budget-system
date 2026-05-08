import { test, expect } from '@playwright/test'

let testEmail: string
let globalPassword = 'T#st1234T#st1234'

test.beforeAll(async ({ page, browserName }) => {
    const uniqueId = Date.now().toString()
    testEmail = `test-account-${browserName}-${uniqueId}@dar.com`

    await page.goto('http://localhost:3000/signup')

    // Enter details
    await page.getByLabel('name').fill(`John Doe ${browserName}`)
    await page.click('text=Select your Entity')
    await page.getByText('Department of Agrarian Reform').nth(1).click()
    await page.getByLabel('email').fill(testEmail)
    await page.getByLabel('position').fill('Personnel Officer')
    await page.getByLabel('password').first().fill(globalPassword)

    // Click signup button
    await page.getByRole('button', { name: 'Sign Up' }).click()
})

test('unverified_login', async ({ page }) => {
    await page.goto('http://localhost:3000/')

    // Click login button
    await page.click('text=Login')

    // Enter user credentials
    await page.getByLabel('email').fill(testEmail)
    await page.getByLabel('password').first().fill(globalPassword)

    // Click login button
    await page.getByRole('button', { name: 'Login' }).click()

    // Expect pending approval page
    await expect(page).toHaveURL('http://localhost:3000/pending-approval')
    await expect(page.getByRole('heading', { name: 'Verification Required' })).toBeVisible()

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page).toHaveURL('http://localhost:3000/login')
})

test('admin_approve_user', async ({ page }) => {
    await page.goto('http://localhost:3000/')

    // Login as admin
    await page.goto('http://localhost:3000/login')
    await page.getByLabel('email').fill('dar-test@dar.com')
    await page.getByLabel('password').first().fill(globalPassword)
    await page.getByRole('button', { name: 'Login' }).click()

    // Expect Admin heading
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()

    // Approve user
    await page.getByRole('button', { name: 'Pending Approvals' }).click()
    await page.click('text=Select Role')
    await page.getByRole('option', { name: 'Department' }).click()
    await page.click('text=Select Workflow')
    await page.getByRole('option', { name: 'Personnel Officer' }).click()
    await page.click('text=Select Level')
    await page.getByRole('option', { name: 'Encoder' }).click()
    await page.getByRole('button', { name: 'Approve' }).first().click()

    // Expect the text no pending users
    await expect(page.getByText("No pending users require approval at this time.")).toBeVisible()

    // Go back
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
})

test('successful_login', async ({ page }) => {
    await page.goto('http://localhost:3000/')

    // Click login button
    await page.click('text=Login')

    // Enter user credentials
    await page.getByLabel('email').fill(testEmail)
    await page.getByLabel('password').first().fill(globalPassword)

    // Click login button
    await page.getByRole('button', { name: 'Login' }).click()

    // Expect log out button to be visible
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible() 
})
