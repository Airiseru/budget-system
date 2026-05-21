import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import HomepageContentManager from '@/components/ui/dbm/HomepageContentManager'
import { sessionDetails } from '@/src/actions/auth'
import { createHomepageContentRepository } from '@/src/db/factory'
import { isActiveUser, isDbmUser, isUnverifiedUser } from '@/src/lib/user-status'

const HomepageContentRepository = createHomepageContentRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DbmHomepageContentPage() {
    const session = await sessionDetails()

    if (!session) redirect('/login')
    if (isUnverifiedUser(session.user)) redirect('/pending-approval')
    if (!isActiveUser(session.user)) redirect('/login')
    if (session.user.role !== 'dbm') redirect('/home')

    const [announcements, faqs] = await Promise.all([
        HomepageContentRepository.listHomepageAnnouncements(),
        HomepageContentRepository.listHomepageFaqs(),
    ])

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 px-4 py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <BackButton url="/dbm" />
                        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-primary-foreground">
                            Homepage CMS
                        </p>
                        <h1 className="mt-2 text-3xl font-black text-secondary-foreground">
                            FAQs, News, and Announcements
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            DBM users can draft and edit homepage content. Only DBM approvers can publish or archive content.
                        </p>
                    </div>
                </div>

                <HomepageContentManager
                    announcements={announcements}
                    faqs={faqs}
                    canPublish={isDbmUser(session.user)}
                />
            </div>
        </main>
    )
}
