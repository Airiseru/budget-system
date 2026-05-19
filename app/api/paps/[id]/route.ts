import { createPapRepository } from '@/src/db/factory'
import { PapUpdate } from '@/src/types/pap'
import { getPapUacsFieldErrors, PapUacsUpdateSchema } from '@/src/lib/validations/uacs'
import { PAP_PROJECT_TYPE_LABELS, type PAP_PROJECT_TYPE } from '@/src/lib/constants'

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const DUPLICATE_PAP_CODE_MESSAGE = 'Another PAP already uses this full PREXC/UACS/PAP code.'

function normalizeProjectType(value?: string | null): PAP_PROJECT_TYPE | null {
    if (!value) return null
    const normalized = value.trim().toLowerCase().replaceAll(' ', '_')
    if (normalized in PAP_PROJECT_TYPE_LABELS) return normalized as PAP_PROJECT_TYPE
    return null
}

function normalizePapProjectType(pap: PapUpdate): PapUpdate {
    const projectType = normalizeProjectType(pap.project_type)
    if (!projectType) {
        return pap
    }

    return {
        ...pap,
        project_type: projectType,
        category: projectType === 'foreign' ? 'foreign' : 'local',
        identifier_code: projectType === 'local' ? '2' : projectType === 'foreign' ? '3' : '1',
    }
}

function isDuplicatePapCodeError(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        error.constraint === 'idx_paps_unique_assigned_full_prexc_uacs_code'
    )
}

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
    const pap: PapUpdate = normalizePapProjectType(await request.json())
    const validatedPapUacs = PapUacsUpdateSchema.safeParse(pap)

    if (!validatedPapUacs.success) {
        return Response.json(
            { fieldErrors: getPapUacsFieldErrors(validatedPapUacs.error) },
            { status: 400 }
        )
    }

    if (PapRepository.hasPapUacsUpdate(validatedPapUacs.data)) {
        const existingPap = await PapRepository.getPapById(id)

        if (!existingPap) {
            return Response.json({ error: 'Pap not found' }, { status: 404 })
        }

        const fullPapCode = PapRepository.buildPapFullCode({
            ...existingPap,
            ...validatedPapUacs.data,
        })

        if (fullPapCode !== PapRepository.UNASSIGNED_PAP_FULL_CODE) {
            const duplicatePap = await PapRepository.getPapByFullCode(fullPapCode, id)

            if (duplicatePap) {
                return Response.json(
                    {
                        error: `${DUPLICATE_PAP_CODE_MESSAGE} Duplicate: ${duplicatePap.title}.`,
                    },
                    { status: 409 },
                )
            }
        }
    }

    try {
        const result = await PapRepository.updatePap(id, pap)
        return new Response(JSON.stringify(result))
    } catch (error) {
        if (isDuplicatePapCodeError(error)) {
            return Response.json({ error: DUPLICATE_PAP_CODE_MESSAGE }, { status: 409 })
        }

        return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to update PAP.' },
            { status: 400 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    await PapRepository.deletePap(id)
    return new Response(null, { status: 204 })
}
