'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createHomepageContentRepository } from '@/src/db/factory'
import { sessionDetails } from './auth'
import { isActiveUser, isDbmUser } from '@/src/lib/user-status'
import type { HomepageContentStatus } from '@/src/types/homepage_content'

const HomepageContentRepository = createHomepageContentRepository(process.env.DATABASE_TYPE || 'postgres')

const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const

const AnnouncementSchema = z.object({
    title: z.string().trim().min(3).max(180),
    body_markdown: z.string().trim().min(3).max(8000),
    category: z.string().trim().max(80).optional(),
    publish_at: z.string().trim().optional(),
    expires_at: z.string().trim().optional(),
    is_pinned: z.boolean(),
    display_order: z.coerce.number().int().min(0).max(9999),
})

const FaqSchema = z.object({
    question: z.string().trim().min(3).max(220),
    answer_markdown: z.string().trim().min(3).max(8000),
    category: z.string().trim().max(80).optional(),
    display_order: z.coerce.number().int().min(0).max(9999),
})

async function requireDbmContentEditor() {
    const session = await sessionDetails()
    if (!session) redirect('/login')
    if (!isActiveUser(session.user) || session.user.role !== 'dbm') redirect('/home')
    return session
}

async function requireDbmContentApprover() {
    const session = await requireDbmContentEditor()
    if (!isDbmUser(session.user)) {
        throw new Error('Only DBM approvers can publish or archive homepage content.')
    }
    return session
}

function emptyToNull(value: string | undefined) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

function dateTimeLocalToDate(value: string | undefined) {
    const trimmed = value?.trim()
    if (!trimmed) return null

    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function revalidateHomepageContent() {
    revalidatePath('/')
    revalidatePath('/dbm')
    revalidatePath('/dbm/homepage-content')
}

export async function createHomepageAnnouncementAction(formData: FormData) {
    const session = await requireDbmContentEditor()
    const parsed = AnnouncementSchema.parse({
        title: formData.get('title'),
        body_markdown: formData.get('body_markdown'),
        category: formData.get('category') ?? undefined,
        publish_at: formData.get('publish_at') ?? undefined,
        expires_at: formData.get('expires_at') ?? undefined,
        is_pinned: formData.get('is_pinned') === 'on',
        display_order: formData.get('display_order') ?? 0,
    })

    await HomepageContentRepository.createHomepageAnnouncement({
        title: parsed.title,
        body_markdown: parsed.body_markdown,
        category: emptyToNull(parsed.category),
        publish_at: dateTimeLocalToDate(parsed.publish_at),
        expires_at: dateTimeLocalToDate(parsed.expires_at),
        is_pinned: parsed.is_pinned,
        display_order: parsed.display_order,
        status: 'draft',
        created_by: session.user.id,
        updated_by: session.user.id,
    })

    revalidateHomepageContent()
}

export async function updateHomepageAnnouncementAction(formData: FormData) {
    const session = await requireDbmContentEditor()
    const id = z.string().uuid().parse(formData.get('id'))
    const parsed = AnnouncementSchema.parse({
        title: formData.get('title'),
        body_markdown: formData.get('body_markdown'),
        category: formData.get('category') ?? undefined,
        publish_at: formData.get('publish_at') ?? undefined,
        expires_at: formData.get('expires_at') ?? undefined,
        is_pinned: formData.get('is_pinned') === 'on',
        display_order: formData.get('display_order') ?? 0,
    })

    await HomepageContentRepository.updateHomepageAnnouncement(id, {
        title: parsed.title,
        body_markdown: parsed.body_markdown,
        category: emptyToNull(parsed.category),
        publish_at: dateTimeLocalToDate(parsed.publish_at),
        expires_at: dateTimeLocalToDate(parsed.expires_at),
        is_pinned: parsed.is_pinned,
        display_order: parsed.display_order,
        updated_by: session.user.id,
    })

    revalidateHomepageContent()
}

export async function updateHomepageAnnouncementStatusAction(formData: FormData) {
    const session = await requireDbmContentApprover()
    const id = z.string().uuid().parse(formData.get('id'))
    const status = z.enum(CONTENT_STATUSES).parse(formData.get('status')) as HomepageContentStatus

    await HomepageContentRepository.updateHomepageAnnouncementStatus(id, status, session.user.id)
    revalidateHomepageContent()
}

export async function createHomepageFaqAction(formData: FormData) {
    const session = await requireDbmContentEditor()
    const parsed = FaqSchema.parse({
        question: formData.get('question'),
        answer_markdown: formData.get('answer_markdown'),
        category: formData.get('category') ?? undefined,
        display_order: formData.get('display_order') ?? 0,
    })

    await HomepageContentRepository.createHomepageFaq({
        question: parsed.question,
        answer_markdown: parsed.answer_markdown,
        category: emptyToNull(parsed.category),
        display_order: parsed.display_order,
        status: 'draft',
        created_by: session.user.id,
        updated_by: session.user.id,
    })

    revalidateHomepageContent()
}

export async function updateHomepageFaqAction(formData: FormData) {
    const session = await requireDbmContentEditor()
    const id = z.string().uuid().parse(formData.get('id'))
    const parsed = FaqSchema.parse({
        question: formData.get('question'),
        answer_markdown: formData.get('answer_markdown'),
        category: formData.get('category') ?? undefined,
        display_order: formData.get('display_order') ?? 0,
    })

    await HomepageContentRepository.updateHomepageFaq(id, {
        question: parsed.question,
        answer_markdown: parsed.answer_markdown,
        category: emptyToNull(parsed.category),
        display_order: parsed.display_order,
        updated_by: session.user.id,
    })

    revalidateHomepageContent()
}

export async function updateHomepageFaqStatusAction(formData: FormData) {
    const session = await requireDbmContentApprover()
    const id = z.string().uuid().parse(formData.get('id'))
    const status = z.enum(CONTENT_STATUSES).parse(formData.get('status')) as HomepageContentStatus

    await HomepageContentRepository.updateHomepageFaqStatus(id, status, session.user.id)
    revalidateHomepageContent()
}
