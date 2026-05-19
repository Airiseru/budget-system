import { createPapRepository } from '@/src/db/factory'
import { NewPap } from '@/src/types/pap'
import { PAP_PROJECT_TYPE_LABELS, type PAP_PROJECT_TYPE } from '@/src/lib/constants'

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

function normalizeProjectType(value?: string | null): PAP_PROJECT_TYPE {
    if (!value) return 'local'
    const normalized = value.trim().toLowerCase().replaceAll(' ', '_')
    if (normalized in PAP_PROJECT_TYPE_LABELS) return normalized as PAP_PROJECT_TYPE
    return 'local'
}

function normalizePapProjectType<T extends NewPap>(pap: T): T {
    const projectType = normalizeProjectType(pap.project_type)

    return {
        ...pap,
        project_type: projectType,
        category: projectType === 'foreign' ? 'foreign' : 'local',
        identifier_code: projectType === 'local' ? '2' : projectType === 'foreign' ? '3' : '1',
    }
}

export async function GET() {
    // TODO: get all relevant pap information (join)
    const paps = await PapRepository.getAllPaps()
    console.log(`GET PAPS RESULT: ${JSON.stringify(paps)}`)
    return new Response(JSON.stringify(paps))
}

export async function POST(
    request: Request
) {
    try {
        const pap: NewPap = await request.json()
        const result = await PapRepository.createPap(normalizePapProjectType(pap))
        console.log(`CREATE PAP RESULT: ${JSON.stringify(result)}`)
        return Response.json(result)
    } catch (error) {
        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to create PAP.' },
            { status: 400 }
        )
    }
}
