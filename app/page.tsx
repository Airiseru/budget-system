import { redirect } from "next/navigation"
import PublicHomepage from "@/components/ui/home/PublicHomepage"
import { sessionWithEntity } from "@/src/actions/auth"
import { createHomepageContentRepository } from "@/src/db/factory"
import { isAdminUser, isUnverifiedUser } from "@/src/lib/user-status"

const HomepageContentRepository = createHomepageContentRepository(process.env.DATABASE_TYPE || "postgres")

export default async function Home() {
    const session = await sessionWithEntity()

    if (session && isAdminUser(session.user)) {
        redirect('/admin')
    }

    if (session && isUnverifiedUser(session.user)) {
        redirect('/pending-approval')
    }

    if (session) {
        redirect('/home')
    }

    const [announcements, faqs] = await Promise.all([
        HomepageContentRepository.listPublishedHomepageAnnouncements(6),
        HomepageContentRepository.listPublishedHomepageFaqs(8),
    ])

    return (
        <PublicHomepage
            announcements={announcements.map((announcement) => ({
                id: announcement.id,
                title: announcement.title,
                body_markdown: announcement.body_markdown,
                category: announcement.category,
                publish_at: announcement.publish_at?.toISOString() ?? null,
                updated_at: announcement.updated_at.toISOString(),
            }))}
            faqs={faqs.map((faq) => ({
                id: faq.id,
                question: faq.question,
                answer_markdown: faq.answer_markdown,
            }))}
        />
    )
}
