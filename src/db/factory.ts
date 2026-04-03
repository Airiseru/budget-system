import * as PostgrePapRepository from '@/src/db/postgres/repositories/papRepository'
import * as PostgreEntityRepository from '@/src/db/postgres/repositories/entityRepository'
import * as PostgreStaffingRepository from '@/src/db/postgres/repositories/staffingRepository'

export function createPapRepository(dbType: string) {
    switch (dbType) {
        case 'postgres':
            return PostgrePapRepository
        default:
            throw new Error(`Unsupported database type: ${dbType}`)
    }
}

export function createEntityRepository(dbType: string) {
    switch (dbType) {
        case 'postgres':
            return PostgreEntityRepository
        default:
            throw new Error(`Unsupported database type: ${dbType}`)
    }
}

export function createStaffingRepository(dbType: string) {
    switch (dbType) {
        case 'postgres':
            return PostgreStaffingRepository
        default:
            throw new Error(`Unsupported database type: ${dbType}`)
    }
}