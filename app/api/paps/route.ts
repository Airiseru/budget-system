import { createPapRepository } from '@/src/db/factory'
import { NewPap } from '@/src/types/pap'

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

function normalizePapProjectType<T extends NewPap>(pap: T): T {
    const projectType = pap.project_type === 'foreign' ? 'foreign' : 'local'

    return {
        ...pap,
        project_type: projectType,
        category: projectType,
        identifier_code: projectType === 'local' ? '2' : '3',
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
    const pap: NewPap = await request.json()
    const result = await PapRepository.createPap(normalizePapProjectType(pap))
    console.log(`CREATE PAP RESULT: ${JSON.stringify(result)}`)
    return new Response(JSON.stringify(result))
}
