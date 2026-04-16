import { NextResponse } from "next/server"
import { createEntityRepository, createAuditRepository } from "@/src/db/factory"

export async function GET(request: Request) {
    const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const entities = await EntityRepository.getAllEntities()
        
        // Seal the logs for each entity
        const results = []
        for (const entity of entities) {
            const result = await AuditRepository.sealDailyAuditLog(entity.id)
            results.push({
                entityId: entity.id,
                ...result
            })
        }

        return NextResponse.json({ success: true, sealed: results })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: "Failed to seal logs" }, { status: 500 })
    }
}