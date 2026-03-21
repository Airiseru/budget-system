import { createPapRepository } from '@/src/db/factory'
import { PapUpdate } from '@/src/types/pap'

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const pap = await PapRepository.getPapById(id)

    if (!pap) {
        return new Response('Pap not found', { status: 404 })
    }

    console.log(`GET PAP RESULT: ${JSON.stringify(pap)}`)
    return new Response(JSON.stringify(pap))
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const pap: PapUpdate = await request.json()
    const result = await PapRepository.updatePap(id, pap)
    return new Response(JSON.stringify(result))
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    await PapRepository.deletePap(id)
    return new Response(null, { status: 204 })
}