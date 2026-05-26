'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import MarkdownContent from '@/components/ui/MarkdownContent'
import { Plus, X } from 'lucide-react'
import {
    createHomepageAnnouncementAction,
    createHomepageFaqAction,
    updateHomepageAnnouncementAction,
    updateHomepageAnnouncementStatusAction,
    updateHomepageFaqAction,
    updateHomepageFaqStatusAction,
} from '@/src/actions/homepageContent'
import type { HomepageAnnouncement, HomepageFaq, HomepageContentStatus } from '@/src/types/homepage_content'

type Props = {
    announcements: HomepageAnnouncement[]
    faqs: HomepageFaq[]
    canPublish: boolean
}

const STATUS_CLASS: Record<HomepageContentStatus, string> = {
    draft: 'border-amber-200 bg-amber-50 text-amber-700',
    published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    archived: 'border-slate-200 bg-slate-50 text-slate-700',
}

const buttonStyles = "rounded-lg hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

type ActiveTab = 'announcements' | 'faqs'
type CreateModal = null | 'announcement' | 'faq'

function formatDateTimeLocal(value: Date | string | null) {
    if (!value) return ''
    const date = new Date(value)
    const offset = date.getTimezoneOffset()
    const local = new Date(date.getTime() - offset * 60_000)
    return local.toISOString().slice(0, 16)
}

function StatusControls({
    id,
    status,
    canPublish,
    action,
}: {
    id: string
    status: HomepageContentStatus
    canPublish: boolean
    action: (formData: FormData) => Promise<void>
}) {
    if (!canPublish) return null

    const nextStatuses: HomepageContentStatus[] = status === 'published'
        ? ['draft', 'archived']
        : ['published', 'archived']

    return (
        <div className="flex flex-wrap gap-2">
            {nextStatuses.map((nextStatus) => (
                <form key={nextStatus} action={action}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="status" value={nextStatus} />
                    <Button
                        type="submit"
                        size="sm"
                        variant={nextStatus === 'published' ? 'default' : 'outline'}
                        className={buttonStyles}
                    >
                        {nextStatus === 'published' ? 'Publish' : nextStatus === 'archived' ? 'Archive' : 'Move to Draft'}
                    </Button>
                </form>
            ))}
        </div>
    )
}

function AnnouncementForm({ announcement }: { announcement?: HomepageAnnouncement }) {
    return (
        <form
            action={async (formData) => {
                if (announcement) {
                    await updateHomepageAnnouncementAction(formData)
                    return
                }

                await createHomepageAnnouncementAction(formData)
                window.dispatchEvent(new Event('homepage-content:create-complete'))
            }}
            className="rounded-2xl border border-border bg-background p-4 shadow-sm"
        >
            {announcement ? <input type="hidden" name="id" value={announcement.id} /> : null}
            <label className="space-y-2">
                <span className="text-sm font-semibold">Title</span>
                <input
                    name="title"
                    defaultValue={announcement?.title ?? ''}
                    className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    required
                />
            </label>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_12rem_10rem]">
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Category</span>
                    <input
                        name="category"
                        defaultValue={announcement?.category ?? ''}
                        className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Order</span>
                    <input
                        name="display_order"
                        type="number"
                        min="0"
                        defaultValue={announcement?.display_order ?? 0}
                        className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                </label>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Publish At</span>
                    <input
                        name="publish_at"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocal(announcement?.publish_at ?? null)}
                        className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Expires At</span>
                    <input
                        name="expires_at"
                        type="datetime-local"
                        defaultValue={formatDateTimeLocal(announcement?.expires_at ?? null)}
                        className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                </label>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
                <input name="is_pinned" type="checkbox" defaultChecked={announcement?.is_pinned ?? false} />
                Pin this announcement
            </label>
            <label className="mt-4 block space-y-2">
                <span className="text-sm font-semibold">Body Markdown</span>
                <textarea
                    name="body_markdown"
                    defaultValue={announcement?.body_markdown ?? ''}
                    className="min-h-36 w-full rounded-md border border-border bg-background px-3 py-2"
                    placeholder="Use **bold**, *italic*, lists, and [links](https://example.com)."
                    required
                />
            </label>
            <div className="mt-4 flex justify-end">
                <Button
                    type="submit"
                    variant="outline"
                    className={buttonStyles}
                >
                    {announcement ? 'Save Announcement' : 'Create Draft Announcement'}
                </Button>
            </div>
        </form>
    )
}

function FaqForm({ faq }: { faq?: HomepageFaq }) {
    return (
        <form
            action={async (formData) => {
                if (faq) {
                    await updateHomepageFaqAction(formData)
                    return
                }

                await createHomepageFaqAction(formData)
                window.dispatchEvent(new Event('homepage-content:create-complete'))
            }}
            className="rounded-2xl border border-border bg-background p-4 shadow-sm"
        >
            {faq ? <input type="hidden" name="id" value={faq.id} /> : null}
            <label className="space-y-2">
                <span className="text-sm font-semibold">Question</span>
                <input
                    name="question"
                    defaultValue={faq?.question ?? ''}
                    className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    required
                />
            </label>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_12rem_10rem]">
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Category</span>
                    <input
                        name="category"
                        defaultValue={faq?.category ?? ''}
                        className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                </label>
                <label className="space-y-2">
                    <span className="text-sm font-semibold">Order</span>
                    <input
                        name="display_order"
                        type="number"
                        min="0"
                        defaultValue={faq?.display_order ?? 0}
                        className="min-h-11 w-full rounded-md border border-border bg-background px-3 py-2"
                    />
                </label>
            </div>
            <label className="mt-4 block space-y-2">
                <span className="text-sm font-semibold">Answer Markdown</span>
                <textarea
                    name="answer_markdown"
                    defaultValue={faq?.answer_markdown ?? ''}
                    className="min-h-32 w-full rounded-md border border-border bg-background px-3 py-2"
                    placeholder="Use **bold**, *italic*, lists, and [links](https://example.com)."
                    required
                />
            </label>
            <div className="mt-4 flex justify-end">
                <Button
                    type="submit"
                    variant="outline"
                    className={buttonStyles}
                >
                    {faq ? 'Save FAQ' : 'Create Draft FAQ'}
                </Button>
            </div>
        </form>
    )
}

export default function HomepageContentManager({ announcements, faqs, canPublish }: Props) {
    const [activeTab, setActiveTab] = useState<ActiveTab>('announcements')
    const [createModal, setCreateModal] = useState<CreateModal>(null)

    useEffect(() => {
        const handleCreateComplete = () => setCreateModal(null)
        window.addEventListener('homepage-content:create-complete', handleCreateComplete)
        return () => window.removeEventListener('homepage-content:create-complete', handleCreateComplete)
    }, [])

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('announcements')}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                            activeTab === 'announcements'
                                ? 'bg-secondary-foreground text-accent'
                                : 'bg-muted text-muted-foreground hover:text-secondary-foreground'
                        }`}
                    >
                        Announcements
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('faqs')}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                            activeTab === 'faqs'
                                ? 'bg-secondary-foreground text-accent'
                                : 'bg-muted text-muted-foreground hover:text-secondary-foreground'
                        }`}
                    >
                        FAQs
                    </button>
                </div>
                <Button
                    type="button"
                    onClick={() => setCreateModal(activeTab === 'announcements' ? 'announcement' : 'faq')}
                    className="gap-2 bg-accent-foreground text-white hover:bg-accent-foreground/90"
                >
                    <Plus className="h-4 w-4" />
                    {activeTab === 'announcements' ? 'New Announcement' : 'New FAQ'}
                </Button>
            </div>

            {activeTab === 'announcements' && (
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-secondary-foreground">Announcements</h2>
                {announcements.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                        No announcements yet.
                    </p>
                ) : announcements.map((announcement) => (
                    <article key={announcement.id} className="space-y-4 rounded-3xl border border-border bg-background p-5 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold text-secondary-foreground">{announcement.title}</h3>
                                    <Badge variant="outline" className={STATUS_CLASS[announcement.status]}>
                                        {announcement.status.toUpperCase()}
                                    </Badge>
                                    {announcement.is_pinned ? <Badge variant="secondary">Pinned</Badge> : null}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {announcement.category || 'General'} • Updated {new Date(announcement.updated_at).toLocaleDateString('en-PH')}
                                </p>
                            </div>
                            <StatusControls
                                id={announcement.id}
                                status={announcement.status}
                                canPublish={canPublish}
                                action={updateHomepageAnnouncementStatusAction}
                            />
                        </div>
                        <details>
                            <summary className="cursor-pointer text-sm font-semibold text-secondary-foreground">Edit announcement</summary>
                            <div className="mt-4">
                                <AnnouncementForm announcement={announcement} />
                            </div>
                        </details>
                        <details>
                            <summary className="cursor-pointer text-sm font-semibold text-secondary-foreground">Preview</summary>
                                <MarkdownContent content={announcement.body_markdown} className="mt-3 border rounded-xl bg-muted/40 p-4" />
                        </details>
                    </article>
                ))}
            </section>
            )}

            {activeTab === 'faqs' && (
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-secondary-foreground">FAQs</h2>
                {faqs.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                        No FAQs yet.
                    </p>
                ) : faqs.map((faq) => (
                    <article key={faq.id} className="space-y-4 rounded-3xl border border-border bg-background p-5 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold text-secondary-foreground">{faq.question}</h3>
                                    <Badge variant="outline" className={STATUS_CLASS[faq.status]}>
                                        {faq.status.toUpperCase()}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {faq.category || 'General'} • Updated {new Date(faq.updated_at).toLocaleDateString('en-PH')}
                                </p>
                            </div>
                            <StatusControls
                                id={faq.id}
                                status={faq.status}
                                canPublish={canPublish}
                                action={updateHomepageFaqStatusAction}
                            />
                        </div>
                        <details>
                            <summary className="cursor-pointer text-sm font-semibold text-secondary-foreground">Edit FAQ</summary>
                            <div className="mt-4">
                                <FaqForm faq={faq} />
                            </div>
                        </details>
                        <details>
                            <summary className="cursor-pointer text-sm font-semibold text-secondary-foreground">Preview</summary>
                            <MarkdownContent content={faq.answer_markdown} className="mt-3 border rounded-xl bg-muted/40 p-4" />
                        </details>
                    </article>
                ))}
            </section>
            )}

            {createModal && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
                    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-background shadow-2xl">
                        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold">
                                    {createModal === 'announcement' ? 'New Announcement' : 'New FAQ'}
                                </h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {createModal === 'announcement'
                                        ? 'Content is saved as draft first. A DBM approver must publish it before it appears on the homepage.'
                                        : 'FAQ answers support the same constrained Markdown format.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCreateModal(null)}
                                className="text-muted-foreground transition-colors hover:text-foreground"
                                aria-label="Close create content dialog"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-6">
                            {createModal === 'announcement' ? <AnnouncementForm /> : <FaqForm />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
