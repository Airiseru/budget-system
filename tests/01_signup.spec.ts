import { test, expect } from '@playwright/test'

const globalPassword = 'T#st1234T#st1234'

test.describe.serial('Signup Flow', () => {
    const uniqueId = Date.now().toString()

    test('successful_signup', async ({ page, browserName }) => {
        await test.step('Signup', async () => {
            await page.goto('http://localhost:3000/')

            await page.click('text=Sign Up')
            await expect(page).toHaveURL('http://localhost:3000/signup')
            await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible()

            await page.getByLabel('name').fill(`John Doe ${browserName}`)
            await page.click('text=Select your Entity')
            await page.getByText('Regional Office I').first().click()
            await page.getByLabel('email').fill(`test-${browserName}-${uniqueId}@dar.com`)
            await page.getByLabel('position').fill('Personnel Officer')
            await page.getByLabel('password').first().fill(globalPassword)

            await page.getByRole('button', { name: 'Sign Up' }).click()
            await expect(page).toHaveURL('http://localhost:3000/login')
        })

        await test.step('Admin reject user', async () => {
            await page.goto('http://localhost:3000/')

            await page.click('text=Login')
            await page.getByLabel('email').fill('dar-test@dar.com')
            await page.getByLabel('password').first().fill(globalPassword)
            await page.getByRole('button', { name: 'Login' }).click()

            await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible()

            await page.getByRole('link', { name: 'Pending Approvals' }).click()

            await page.getByRole('button', { name: 'Reject User' }).click()
            await page.getByRole('button', { name: 'Reject User' }).last().click()

            await expect(page.getByText('No pending users require approval at this time.')).toBeVisible()
        })
    })

    test('unsuccessful_signup', async ({ page }) => {
        await page.goto('http://localhost:3000/')

        await page.click('text=Sign Up')
        await expect(page).toHaveURL('http://localhost:3000/signup')
        await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible()

        await page.getByLabel('name').fill('A')
        await page.click('text=Select your Entity')
        await page.getByText('Department of Agrarian Reform').first().click()
        await page.getByLabel('email').fill('a@b')
        await page.getByLabel('position').fill('A')
        await page.getByLabel('password').first().fill('A')

        await page.getByRole('button', { name: 'Sign Up' }).click()

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
})