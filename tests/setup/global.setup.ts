import { db } from "@/src/db/postgres/database"
import { createEntityRepository } from "@/src/db/factory"
import { auth } from "@/src/lib/auth"
import { User, Agency, OperatingUnit } from "@/src/types/entities"

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function globalSetup() {
    console.log('Setting up database for Playwright Test')

    const departments = await EntityRepository.getAllDepartments()
    const agencies = await EntityRepository.getAllAgencies()
    
    let dbmExists = false
    let darExists = false
    let darPersonnelExists = false
    let darBudgetExists = false
    let dbmOS = null
    let darOS: Partial<Agency> | null | undefined = null
    let darOU: Partial<OperatingUnit> | null | undefined = null
    
    // Check if department exists
    if (departments.find(d => d.name === 'Department of Budget and Management')) dbmExists = true
    if (departments.find(d => d.name === 'Department of Agrarian Reform')) darExists = true

    if (!dbmExists) {
        // Create DBM
        const dbm = await EntityRepository.createDepartment({
            name: 'Department of Budget and Management',
            abbr: 'DBM',
            uacs_code: '06'
        })
    
        // Create Office of the Secretary
        dbmOS = await EntityRepository.createAgency({
            name: 'Office of the Secretary',
            uacs_code: '001',
            type: 'bureau'
        }, dbm.id)
    }
    else {
        dbmOS = agencies.find(a =>
            a.department_id === departments.find(
                d => d.name === 'Department of Budget and Management'
            )?.id
            && a.name === 'Office of the Secretary'
        )
    }

    if (!darExists) {
        // Create DAR
        const dar = await EntityRepository.createDepartment({
            name: 'Department of Agrarian Reform',
            abbr: 'DAR',
            uacs_code: '04'
        })

        // Create Office of the Secretary
        darOS = await EntityRepository.createAgency({
            name: 'Office of the Secretary',
            uacs_code: '001',
            type: 'bureau'
        }, dar.id)

        // Create OU
        const parentOU = await EntityRepository.createOperatingUnit({
            name: 'Department/Agency Regional Offices/Centers for Health Development/Regional Field Units',
            uacs_code: '03'
        }, darOS.id as string)

        darOU = await EntityRepository.createOperatingUnit({
            name: 'Regional Office I - Proper',
            uacs_code: '00001',
            parent_ou_id: parentOU.id
        }, darOS.id as string)
    }

    // Check if DBM user exists
    const dbmEmail = 'dbm-test@dbm.com'
    let dbmUser: Partial<User> | null | undefined = await db.selectFrom('users')
        .where('email', '=', dbmEmail)
        .executeTakeFirst()

    if (!dbmUser) {
        // Create DBM admin user
        const response = await auth.api.signUpEmail({
            body: {
                email: dbmEmail,
                password: 'T#st1234T#st1234',
                name: 'John Dbm',
                entity_id: dbmOS?.id as string,
                position: 'Agency Head'
            },
            asResponse: true
        })

        if (response.status !== 200) {
            throw new Error('Failed to create DBM user')
        }

        const responseData = await response.json()

        dbmUser = {
            id: responseData.user.id,
            name: responseData.user.name,
            email: responseData.user.email,
        }
    }

    // Check if DAR OS Agency Head exists
    const darEmail = 'dar-test@dar.com'
    let darUser: Partial<User> | null | undefined = await db.selectFrom('users')
        .where('email', '=', darEmail)
        .executeTakeFirst()

    if (!darUser) {
        // Create DAR admin user
        const response = await auth.api.signUpEmail({
            body: {
                email: darEmail,
                password: 'T#st1234T#st1234',
                name: 'John Dar',
                entity_id: darOS?.id as string,
                position: 'Agency Head'
            },
            asResponse: true
        })

        if (response.status !== 200) {
            throw new Error('Failed to create DAR user')
        }

        const responseData = await response.json()

        darUser = {
            id: responseData.user.id,
            name: responseData.user.name,
            email: responseData.user.email,
        }
    }

    // Check if DAR Personnel exists
    const darPersonnelEmail = 'dar-personnel-test@dar.com'
    let darPersonnelUser: Partial<User> | null | undefined = await db.selectFrom('users')
        .where('email', '=', darPersonnelEmail)
        .executeTakeFirst()

    if (!darPersonnelUser) {
        // Create DAR Personnel user
        const response = await auth.api.signUpEmail({
            body: {
                email: darPersonnelEmail,
                password: 'T#st1234T#st1234',
                name: 'John Dar Personnel',
                entity_id: darOU?.id as string,
                position: 'Personnel Officer'
            },
            asResponse: true
        })

        if (response.status !== 200) {
            throw new Error('Failed to create DAR Personnel user')
        }

        const responseData = await response.json()

        darPersonnelUser = {
            id: responseData.user.id,
            name: responseData.user.name,
            email: responseData.user.email,
        }
    }

    // Check if DAR Budget exists
    const darBudgetEmail = 'dar-budget-test@dar.com'
    let darBudgetUser: Partial<User> | null | undefined = await db.selectFrom('users')
        .where('email', '=', darBudgetEmail)
        .executeTakeFirst()

    if (!darBudgetUser) {
        // Create DAR Budget user
        const response = await auth.api.signUpEmail({
            body: {
                email: darBudgetEmail,
                password: 'T#st1234T#st1234',
                name: 'John Dar Budget',
                entity_id: darOU?.id as string,
                position: 'Budget Officer'
            },
            asResponse: true
        })

        if (response.status !== 200) {
            throw new Error('Failed to create DAR Budget user')
        }

        const responseData = await response.json()

        darBudgetUser = {
            id: responseData.user.id,
            name: responseData.user.name,
            email: responseData.user.email,
        }
    }

    // Set privileges
    await EntityRepository.updateUser(dbmUser.id ?? '', {
        role: 'dbm', 
        access_level: 'approve',
        workflow_role: 'dbm',
        is_admin: true,
        status: 'active',
    })

    await EntityRepository.updateUser(darUser.id ?? '', {
        role: 'agency',
        access_level: 'approve',
        workflow_role: 'agency_head',
        is_admin: true,
        status: 'active',
    })

    await EntityRepository.updateUser(darPersonnelUser.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'personnel_officer',
        status: 'active',
    })

    await EntityRepository.updateUser(darBudgetUser.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'budget_officer',
        status: 'active',
    })

}