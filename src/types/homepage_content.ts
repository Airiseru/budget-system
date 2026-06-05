import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

export type HomepageContentStatus = 'draft' | 'published' | 'archived'

export interface HomepageAnnouncementTable {
    id: Generated<string>
    title: string
    body_markdown: string
    category: string | null
    publish_at: Date | null
    expires_at: Date | null
    status: HomepageContentStatus
    is_pinned: boolean
    display_order: number
    created_by: string | null
    updated_by: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface HomepageFaqTable {
    id: Generated<string>
    question: string
    answer_markdown: string
    category: string | null
    status: HomepageContentStatus
    display_order: number
    created_by: string | null
    updated_by: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type HomepageAnnouncement = Selectable<HomepageAnnouncementTable>
export type NewHomepageAnnouncement = Insertable<HomepageAnnouncementTable>
export type HomepageAnnouncementUpdate = Updateable<HomepageAnnouncementTable>

export type HomepageFaq = Selectable<HomepageFaqTable>
export type NewHomepageFaq = Insertable<HomepageFaqTable>
export type HomepageFaqUpdate = Updateable<HomepageFaqTable>
