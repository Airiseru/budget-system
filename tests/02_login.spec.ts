import { test, expect } from '@playwright/test'

let testEmail: string
const globalPassword = 'T#st1234T#st1234'

test.describe.serial('Authentication Flow', () => {
    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage()
        const browserName = page?.context()?.browser()?.browserType()?.name()
        const uniqueId = Date.now().toString()
        testEmail = `test-account-${browserName}-${uniqueId}@dar.com`

        await page.goto('http://localhost:3000/signup')

        await page.getByLabel('name').fill(`John Doe ${browserName}`)
        await page.click('text=Select your Entity')
        await page.getByText('Regional Office I').first().click()
        await page.getByLabel('email').fill(testEmail)
        await page.getByLabel('position').fill('Personnel Officer')
        await page.getByLabel('password').first().fill(globalPassword)

        await page.getByRole('button', { name: 'Sign Up' }).click()
        await page.close()
    })

    test('login', async ({ page }) => {
        await test.step('Unverified Login', async () => {
            await page.goto('http://localhost:3000/')
            await page.click('text=Login')
            await page.getByLabel('email').fill(testEmail)
            await page.getByLabel('password').first().fill(globalPassword)
            await page.getByRole('button', { name: 'Login' }).click()

            // Expect pending approval page
            await expect(page).toHaveURL('http://localhost:3000/pending-approval')
            await expect(page.getByRole('heading', { name: 'Verification Required' })).toBeVisible()
            await page.getByRole('button', { name: 'Logout' }).click()
            await expect(page).toHaveURL('http://localhost:3000/login')
        })

        await test.step('Admin approve user', async () => {
            // Login
            await page.goto('http://localhost:3000/')
            await page.click('text=Login')

            // Enter user credentials
            await page.getByLabel('email').fill('dar-test@dar.com')
            await page.getByLabel('password').first().fill(globalPassword)
            await page.getByRole('button', { name: 'Login' }).click()

            // Expect Admin heading
            await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()

            // Approve user
            await page.getByRole('button', { name: 'Pending Approvals' }).click()
            await page.click('text=Select Role')
            await page.getByRole('option', { name: 'Operating Unit' }).click()
            await page.click('text=Select Workflow')
            await page.getByRole('option', { name: 'Personnel Officer' }).click()
            await page.click('text=Select Level')
            await page.getByRole('option', { name: 'Encoder' }).click()
            await page.getByRole('button', { name: 'Approve' }).first().click()

            // Expect the text no pending users
            await expect(page.getByText('No pending users require approval at this time.')).toBeVisible()

            // Go back to admin home page
            await page.getByRole('button', { name: 'Back' }).click()
            await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()
            await page.getByRole('button', { name: 'Home' }).click()
            await page.getByRole('button', { name: 'Logout' }).click()
            await expect(page).toHaveURL('http://localhost:3000/login')
        })

        await test.step('Successful login', async () => {
            await page.goto('http://localhost:3000/')
            await page.click('text=Login')
            await page.getByLabel('email').fill(testEmail)
            await page.getByLabel('password').first().fill(globalPassword)
            await page.getByRole('button', { name: 'Login' }).click()
            await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
        })
    })
})