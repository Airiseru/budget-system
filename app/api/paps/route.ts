import { createPapRepository } from '@/src/db/factory'
import { NewPap } from '@/src/types/pap'

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export async function GET(
    request: Request
) {
    // TODO: get all relevant pap information (join)
    const paps = await PapRepository.getAllPaps()
    console.log(`GET PAPS RESULT: ${JSON.stringify(paps)}`)
    return new Response(JSON.stringify(paps))
}

export async function POST(
    request: Request
) {
    const pap: NewPap = await request.json()
    const result = await PapRepository.createPap(pap)
    console.log(`CREATE PAP RESULT: ${JSON.stringify(result)}`)
    return new Response(JSON.stringify(result))
}