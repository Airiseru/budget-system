import { NextResponse } from 'next/server'
import { sessionWithEntity } from '@/src/actions/auth'

export async function GET() {
    const session = await sessionWithEntity()

    if (!session) {
        return NextResponse.json({ user: null })
    }

    return NextResponse.json({
        user: {
            name: session.user.name,
            position: session.user.position || 'No position set',
            entity: session.user_entity.entity_full_name
                ?? session.user_entity.entity_name
                ?? 'No entity assigned',
        },
    })
}
