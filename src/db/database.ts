import {
    Kysely,
    PostgresDialect
} from 'kysely'
import { Pool } from 'pg'
import { Database } from './types'
import 'dotenv/config'

declare global {
  var db: Kysely<Database> | undefined
}

function createDb() {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined')
    }

    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({
                connectionString,
            }),
        }),
    })
}

// In dev, reuse the db instance across hot reloads
// In prod, always create a fresh instance
export const db = globalThis.db ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalThis.db = db
}