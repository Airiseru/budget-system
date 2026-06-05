import { db } from "@/src/db/postgres/database"
import { createEntityRepository } from "@/src/db/factory"
import { auth } from "@/src/lib/auth"
import { User, Department, Agency, OperatingUnit } from "@/src/types/entities"

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

async function createUser(email: string, entity_id: string, name: string, position: string): Promise<Partial<User>> {
    let user = await db.selectFrom('users')
        .where('email', '=', email)
        .executeTakeFirst()

    if (!user) {
        const response = await auth.api.signUpEmail({
            body: {
                email: email,
                password: 'T#st1234T#st1234',
                name: name,
                entity_id: entity_id,
                position: position
            },
            asResponse: true
        })
    
        if (response.status !== 200) {
            throw new Error('Failed to create DBM user')
        }
    
        const responseData = await response.json()
    
        user = {
            id: responseData.user.id,
            name: responseData.user.name,
            email: responseData.user.email,
        }
    }

    return user
}

export default async function globalSetup() {
    console.log('Setting up database for Playwright Test')

    const departments = await EntityRepository.getAllDepartments()
    const agencies = await EntityRepository.getAllAgencies()
    
    let dbmExists = false
    let darExists = false
    let dpwhExists = false

    let dbm: Partial<Department> | null | undefined = null
    let dbmOS: Partial<Agency> | null | undefined = null
    let dar: Partial<Department> | null | undefined = null
    let darOS: Partial<Agency> | null | undefined = null
    let darOU: Partial<OperatingUnit> | null | undefined = null
    let dpwh: Partial<Department> | null | undefined = null
    let dpwhOS: Partial<Agency> | null | undefined = null
    let dpwhOU1: Partial<OperatingUnit> | null | undefined = null
    let dpwhOU2: Partial<OperatingUnit> | null | undefined = null
    
    // Check if department exists
    if (departments.find(d => d.name === 'Department of Budget and Management')) dbmExists = true
    if (departments.find(d => d.name === 'Department of Agrarian Reform')) darExists = true
    if (departments.find(d => d.name === 'Department of Public Works and Highways')) dpwhExists = true

    if (!dbmExists) {
        // Create DBM
        dbm = await EntityRepository.createDepartment({
            name: 'Department of Budget and Management',
            abbr: 'DBM',
            uacs_code: '06'
        })
    
        // Create Office of the Secretary
        dbmOS = await EntityRepository.createAgency({
            name: 'Office of the Secretary',
            uacs_code: '001',
            type: 'bureau'
        }, dbm.id as string)
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
        dar = await EntityRepository.createDepartment({
            name: 'Department of Agrarian Reform',
            abbr: 'DAR',
            uacs_code: '04'
        })

        // Create Office of the Secretary
        darOS = await EntityRepository.createAgency({
            name: 'Office of the Secretary',
            uacs_code: '001',
            type: 'bureau'
        }, dar.id as string)

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

    if (!dpwhExists) {
        // Create DPWH
        dpwh = await EntityRepository.createDepartment({
            name: 'Department of Public Works and Highways',
            abbr: 'DPWH',
            uacs_code: '18'
        })

        // Create Office of the Secretary
        dpwhOS = await EntityRepository.createAgency({
            name: 'Office of the Secretary',
            uacs_code: '001',
            type: 'bureau'
        }, dpwh.id as string)

        // Create OU
        const parentOU = await EntityRepository.createOperatingUnit({
            name: 'District Engineering Offices and Sub District Engineering Offices',
            uacs_code: '18'
        }, dpwhOS.id as string)

        dpwhOU1 = await EntityRepository.createOperatingUnit({
            name: 'Batangas 1st District Engineering Office',
            uacs_code: '00056',
            parent_ou_id: parentOU.id
        }, dpwhOS.id as string)

        dpwhOU2 = await EntityRepository.createOperatingUnit({
            name: 'Batangas 2nd District Engineering Office',
            uacs_code: '00057',
            parent_ou_id: parentOU.id
        }, dpwhOS.id as string)
    }

    // Check if DBM user exists
    const dbmSecretaryEmail = 'dbm-secretary-test@dbm.com'
    let dbmSecretaryUser = await createUser(dbmSecretaryEmail, dbm?.id as string, "John Dbm Secretary", "Department Secretary")

    // Check if DBM Agency Head exists
    const dbmEmail = 'dbm-test@dbm.com'
    let dbmUser = await createUser(dbmEmail, dbmOS?.id as string, "John Dbm", "Agency Head")

    // Check if DAR user exists
    const darSecretaryEmail = 'dar-secretary-test@dar.com'
    let darSecretaryUser = await createUser(darSecretaryEmail, dar?.id as string, "John Dar Secretary", "Department Secretary")

    // Check if DAR OS Agency Head exists
    const darEmail = 'dar-test@dar.com'
    let darUser = await createUser(darEmail, darOS?.id as string, "John Dar", "Agency Head")

    // Check if DAR Personnel exists
    const darPersonnelEmail = 'dar-personnel-test@dar.com'
    let darPersonnelUser = await createUser(darPersonnelEmail, darOU?.id as string, "John Dar Personnel", "Personnel Officer")

    // Check if DAR Budget exists
    const darBudgetEmail = 'dar-budget-test@dar.com'
    let darBudgetUser = await createUser(darBudgetEmail, darOU?.id as string, "John Dar Budget", "Budget Officer")

    // Check if DAR Planning Officer exists
    const darPlanningEmail = 'dar-planning-test@dar.com'
    let darPlanningUser = await createUser(darPlanningEmail, darOU?.id as string, "John Dar Planning", "Planning Officer")

    // Check if DAR Chief Accountant exists
    const darCAEmail = 'dar-ca-test@dar.com'
    let darCAUser = await createUser(darCAEmail, darOU?.id as string, "John Dar CA", "Chief Accountant")

    // Check if DPWH Secretary exists
    const dpwhSecretaryEmail = 'dpwh-secretary-test@dpwh.com'
    let dpwhSecretaryUser = await createUser(dpwhSecretaryEmail, dpwh?.id as string, "John DPWH Secretary", "Department Secretary")

    // Check if DPWH Budget exists
    const dpwhBudgetEmail = 'dpwh-budget-test'
    let dpwhBudgetUser1 = await createUser(`${dpwhBudgetEmail}1@dpwh.com`, dpwhOU1?.id as string, "John DPWH Budget 1", "Budget Officer")
    let dpwhBudgetUser2 = await createUser(`${dpwhBudgetEmail}2@dpwh.com`, dpwhOU2?.id as string, "John DPWH Budget 2", "Budget Officer")

    // Check if DPWH Planning Officer exists
    const dpwhPlanningEmail = 'dpwh-planning-test'
    let dpwhPlanningUser1 = await createUser(`${dpwhPlanningEmail}1@dpwh.com`, dpwhOU1?.id as string, "John DPWH Planning 1", "Planning Officer")
    let dpwhPlanningUser2 = await createUser(`${dpwhPlanningEmail}2@dpwh.com`, dpwhOU2?.id as string, "John DPWH Planning 2", "Planning Officer")

    // Check if DPWH Chief Accountant exists
    const dpwhCAEmail = 'dpwh-ca-test@dpwh.com'
    let dpwhCAUser = await createUser(dpwhCAEmail, dpwhOS?.id as string, "John DPWH CA", "Chief Accountant")

    // Check if DPWH Agency Head exists
    const dpwhAgencyEmail = 'dpwh-agency-test@dpwh.com'
    let dpwhAgencyUser = await createUser(dpwhAgencyEmail, dpwhOS?.id as string, "John DPWH Agency", "Agency Head")

    // Set privileges
    await EntityRepository.updateUser(dbmSecretaryUser.id ?? '', {
        role: 'dbm',
        access_level: 'approve',
        workflow_role: 'department_secretary',
        is_admin: true,
        status: 'active',
    })

    await EntityRepository.updateUser(dbmUser.id ?? '', {
        role: 'dbm', 
        access_level: 'approve',
        workflow_role: 'dbm',
        is_admin: true,
        status: 'active',
    })

    await EntityRepository.updateUser(darSecretaryUser.id ?? '', {
        role: 'department',
        access_level: 'approve',
        workflow_role: 'department_secretary',
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

    await EntityRepository.updateUser(darPlanningUser.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'planning_officer',
        status: 'active',
    })

    await EntityRepository.updateUser(darCAUser.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'chief_accountant',
        status: 'active',
    })

    await EntityRepository.updateUser(dpwhSecretaryUser.id ?? '', {
        role: 'department',
        access_level: 'approve',
        workflow_role: 'department_secretary',
        status: 'active',
    })

    await EntityRepository.updateUser(dpwhBudgetUser1.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'budget_officer',
        status: 'active',
    })

    await EntityRepository.updateUser(dpwhBudgetUser2.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'budget_officer',
        status: 'active',
    })
    
    await EntityRepository.updateUser(dpwhPlanningUser1.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'planning_officer',
        status: 'active',
    })

    await EntityRepository.updateUser(dpwhPlanningUser2.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'planning_officer',
        status: 'active',
    })
    
    await EntityRepository.updateUser(dpwhCAUser.id ?? '', {
        role: 'ou',
        access_level: 'encode',
        workflow_role: 'chief_accountant',
        status: 'active',
    })

    await EntityRepository.updateUser(dpwhAgencyUser.id ?? '', {
        role: 'ou',
        access_level: 'approve',
        workflow_role: 'agency_head',
        is_admin: true,
        status: 'active',
    })

}