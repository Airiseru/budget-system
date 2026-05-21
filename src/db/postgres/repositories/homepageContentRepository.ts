import { db } from '../database'
import type {
    HomepageAnnouncementUpdate,
    HomepageContentStatus,
    HomepageFaqUpdate,
    NewHomepageAnnouncement,
    NewHomepageFaq,
} from '@/src/types/homepage_content'

export async function listHomepageAnnouncements() {
    return await db
        .selectFrom('homepage_announcements')
        .selectAll()
        .orderBy('is_pinned', 'desc')
        .orderBy('display_order', 'asc')
        .orderBy('updated_at', 'desc')
        .execute()
}

export async function listPublishedHomepageAnnouncements(limit = 6) {
    const now = new Date()

    return await db
        .selectFrom('homepage_announcements')
        .selectAll()
        .where('status', '=', 'published')
        .where((eb) =>
            eb.or([
                eb('publish_at', 'is', null),
                eb('publish_at', '<=', now),
            ])
        )
        .where((eb) =>
            eb.or([
                eb('expires_at', 'is', null),
                eb('expires_at', '>=', now),
            ])
        )
        .orderBy('is_pinned', 'desc')
        .orderBy('display_order', 'asc')
        .orderBy('publish_at', 'desc')
        .orderBy('updated_at', 'desc')
        .limit(limit)
        .execute()
}

export async function createHomepageAnnouncement(values: NewHomepageAnnouncement) {
    return await db
        .insertInto('homepage_announcements')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateHomepageAnnouncement(id: string, values: HomepageAnnouncementUpdate) {
    return await db
        .updateTable('homepage_announcements')
        .set({
            ...values,
            updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateHomepageAnnouncementStatus(id: string, status: HomepageContentStatus, userId: string) {
    return await updateHomepageAnnouncement(id, {
        status,
        updated_by: userId,
    })
}

export async function listHomepageFaqs() {
    return await db
        .selectFrom('homepage_faqs')
        .selectAll()
        .orderBy('display_order', 'asc')
        .orderBy('updated_at', 'desc')
        .execute()
}

export async function listPublishedHomepageFaqs(limit = 12) {
    return await db
        .selectFrom('homepage_faqs')
        .selectAll()
        .where('status', '=', 'published')
        .orderBy('display_order', 'asc')
        .orderBy('updated_at', 'desc')
        .limit(limit)
        .execute()
}

export async function createHomepageFaq(values: NewHomepageFaq) {
    return await db
        .insertInto('homepage_faqs')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateHomepageFaq(id: string, values: HomepageFaqUpdate) {
    return await db
        .updateTable('homepage_faqs')
        .set({
            ...values,
            updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateHomepageFaqStatus(id: string, status: HomepageContentStatus, userId: string) {
    return await updateHomepageFaq(id, {
        status,
        updated_by: userId,
    })
}
