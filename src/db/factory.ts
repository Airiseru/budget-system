import * as PostgrePapRepository from '@/src/db/postgres/repositories/papRepository'

export function createPapRepository(dbType: string) {
    switch (dbType) {
        case 'postgres':
            return PostgrePapRepository
        default:
            throw new Error(`Unsupported database type: ${dbType}`)
    }
}