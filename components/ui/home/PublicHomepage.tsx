'use client'

import Link from "next/link"
import { ArrowRight, BarChart3, CalendarDays, FileText, History, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import Carousel from "@/components/ui/Carousel"
import MarkdownContent from "@/components/ui/MarkdownContent"

export type PublicAnnouncement = {
    id: string
    title: string
    body_markdown: string
    category: string | null
    publish_at: string | null
    updated_at: string
}

export type PublicFaq = {
    id: string
    question: string
    answer_markdown: string
}

type Props = {
    announcements: PublicAnnouncement[]
    faqs: PublicFaq[]
}

function formatDate(value: string | null) {
    if (!value) return "Latest update"
    return new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value))
}

export default function PublicHomepage({ announcements, faqs }: Props) {
    const acronymItems = [
        {
            letter: 'B',
            title: 'Balanced',
            description: 'Ensures fiscal accountability so taxpayer funds are allocated efficiently and spent properly.',
        },
        {
            letter: 'U',
            title: 'Unified',
            description: 'Centralizes proposals, receipts, line items, and related agency documents in one database repository.',
        },
        {
            letter: 'D',
            title: 'Digitalized',
            description: 'Digitizes forms, signatures, receipts, and project tracking through hashed PIN signatures and audit proofs.',
        },
        {
            letter: 'G',
            title: 'Government Expenditure',
            description: 'Accurately models the government budget process from proposal preparation through NEP and GAA stages.',
        },
        {
            letter: 'E',
            title: 'Everything in Data',
            description: 'Enforces constitutional budget logic in data, including controls such as preventing GAA from exceeding NEP.',
        },
        {
            letter: 'T',
            title: 'Transparency',
            description: 'Preserves data lineage through an immutable hashed audit chain and supports public visibility into the budget process.',
        },
    ]
    const heroCarouselItems = [
        {
            id: 'digitalizing-paper-trails',
            title: 'Digitalizing Paper Trails',
            description: "Say goodbye to lost physical forms. The system fully digitalizes traditional budget documents to accelerate the government's digital transformation efforts.",
        },
        {
            id: 'accountable-data',
            title: 'Built for Accountable Data',
            description: 'Every action is tracked. By combining role-based access, secure digital signatures, and permanent audit logs, the system ensures complete transparency during the budget process.',
        },
        {
            id: 'complete-proposal-history',
            title: 'Complete Proposal History',
            description: 'Nothing is ever lost or deleted without a trace. The system keeps a permanent historical record of all changes, rejections, and revisions to make audits and congressional reviews effortless.',
        },
        {
            id: 'real-time-dashboards',
            title: 'Real-Time Dashboards',
            description: 'See the big picture instantly. Analysts can monitor up-to-date totals and track line-item allocations across hundreds of thousands of records.',
        },
    ]
    const heroCarouselIcons = {
        'digitalizing-paper-trails': FileText,
        'accountable-data': ShieldCheck,
        'complete-proposal-history': History,
        'real-time-dashboards': BarChart3,
    }

    return (
        <main className="min-h-screen bg-[#f7f3ea] text-slate-950">
            <nav className="sticky top-0 z-40 border-b border-slate-900/10 bg-[#f7f3ea]/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
                    <Link href="/" className="text-lg font-black tracking-tight">
                        BUDGET System
                    </Link>
                    <div className="hidden items-center gap-6 text-md font-semibold text-slate-700 md:flex">
                        <Link href="#about" className="hover:text-slate-950">About</Link>
                        <Link href="#announcements" className="hover:text-slate-950">News</Link>
                        <Link href="#faqs" className="hover:text-slate-950">FAQs</Link>
                        <Link href="#disclaimer" className="hover:text-slate-950">Disclaimer</Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="hover:bg-secondary-foreground hover:text-white" nativeButton={false} render={<Link href="/login" />}>
                            Login
                        </Button>
                        <Button className="bg-primary-foreground text-white hover:bg-primary-foreground/70" nativeButton={false} render={<Link href="/signup" />}>
                            Sign Up
                        </Button>
                    </div>
                </div>
            </nav>

            <section className="relative overflow-hidden border-b border-slate-900/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(221,214,254,0.82),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(196,181,253,0.42),transparent_28%),radial-gradient(circle_at_70%_90%,rgba(237,233,254,0.72),transparent_26%)]" />
                <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.35em] text-primary-foreground">
                            Philippine Budget Portal for Government Entities
                        </p>
                        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-7xl">
                            Balanced, unified, and digitalized government expenditure and transparency system.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
                            BUDGET turns the preparation, review, and approval process into accountable data: proposals, allocations, signatures, and audit trails working from one source of truth.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button size="lg" className="bg-primary-foreground text-white hover:bg-primary-foreground/70" nativeButton={false} render={<Link href="/signup" />}>
                                Create an account <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button size="lg" variant="outline" className="border-slate-900/20 bg-white/70" nativeButton={false} render={<Link href="/login" />}>
                                Sign in
                            </Button>
                        </div>
                    </div>
                    <div className="rounded-[2rem] border border-slate-900/10 bg-primary-foreground/65 p-6 shadow-2xl backdrop-blur">
                        <Carousel
                            items={heroCarouselItems}
                            autoPlayIntervalMs={7500}
                            className="rounded-[1.5rem] bg-slate-950 p-6 text-white"
                            renderItem={(item) => {
                                const Icon = heroCarouselIcons[item.id as keyof typeof heroCarouselIcons] ?? ShieldCheck

                                return (
                                    <article className="min-h-72">
                                        <Icon className="h-10 w-10 text-violet-300" />
                                        <h2 className="mt-8 text-2xl font-black">{item.title}</h2>
                                        <p className="mt-3 text-md leading-7 text-slate-300">{item.description}</p>
                                    </article>
                                )
                            }}
                        />
                    </div>
                </div>
            </section>

            <section id="about" className="mx-auto max-w-7xl px-4 py-16">
                <div className="grid gap-10">
                    <div>
                        <p className="text-md font-black uppercase tracking-[0.3em] text-primary-foreground">About</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight">About the Project</h2>
                        <p className="mt-3 max-w-3xl text-md leading-7 text-slate-600">
                            BUDGET is an acronym for the system&apos;s design principles: fiscal balance, unified records, digitized workflows, government expenditure modeling, data-driven controls, and transparency.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.25em] text-primary-foreground">Key Features</p>
                            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">What the system supports</h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {[
                                ['Entity Workflows', 'Departments, agencies, and operating units can work within their hierarchy.'],
                                ['DBM Review', 'DBM users can review proposals, manage PAPs, and prepare NEP/GAA allocations.'],
                                ['Integrity Checks', 'Digital signatures and audit trails support tamper-aware review of submitted forms.'],
                            ].map(([title, description]) => (
                                <article key={title} className="rounded-3xl border border-slate-900/10 bg-white/70 p-6 shadow-sm">
                                    <h3 className="font-black">{title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-700">Meaning of the Acronym</p>
                            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">What BUDGET stands for</h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {acronymItems.map((item) => (
                                <article key={item.letter} className="rounded-3xl border border-violet-200/80 bg-white/75 p-5 shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl font-black text-violet-800">
                                            {item.letter}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-950">{item.title}</h3>
                                            <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id="announcements" className="bg-slate-950 px-4 py-16 text-white">
                <div className="mx-auto max-w-7xl">
                    <div className="">
                        <div>
                            <p className="text-md font-black uppercase tracking-[0.3em] text-primary-foreground">Latest Updates</p>
                            <h2 className="mt-3 text-3xl font-black tracking-tight">News and Announcements</h2>
                        </div>
                        <p className="max-w-xl text-md leading-7 text-slate-300">
                            Published announcements are maintained by DBM through the content management page.
                        </p>
                    </div>
                    <div className="mt-8 w-full max-h-[400px] overflow-y-scroll">
                        {announcements.length === 0 ? (
                            <p className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 text-md text-slate-300">
                                No published announcements yet.
                            </p>
                        ) : announcements.map((announcement) => (
                            <article key={announcement.id} className="rounded-3xl border border-white/10 bg-white/[0.1] p-6 shadow-xl">
                                <div className="flex items-center gap-2 text-s font-bold uppercase tracking-[0.2em] text-primary-foreground">
                                    <CalendarDays className="h-4 w-4" />
                                    {formatDate(announcement.publish_at ?? announcement.updated_at)}
                                </div>
                                <h3 className="mt-4 text-xl font-black">{announcement.title}</h3>
                                {announcement.category ? (
                                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        {announcement.category}
                                    </p>
                                ) : null}
                                <MarkdownContent content={announcement.body_markdown} className="mt-4 text-slate-300 [&_a]:text-primary-foreground [&_h3]:text-white" />
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section id="faqs" className="mx-auto max-w-4xl px-4 py-16">
                <div className="text-center">
                    <p className="text-md font-black uppercase tracking-[0.3em] text-primary-foreground">Help</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight">Frequently Asked Questions</h2>
                </div>
                <div className="mt-8 space-y-3">
                    {faqs.length === 0 ? (
                        <p className="rounded-3xl border border-dashed border-slate-900/20 bg-white/60 p-6 text-center text-md text-slate-600">
                            No published FAQs yet.
                        </p>
                    ) : faqs.map((faq) => (
                        <details key={faq.id} className="group rounded-2xl border border-slate-900/10 bg-white/75 p-5 shadow-sm">
                            <summary className="cursor-pointer list-none text-base font-black text-slate-950">
                                <span className="inline-flex w-full items-center justify-between gap-4">
                                    {faq.question}
                                    <span className="text-primary-foreground transition group-open:rotate-45">+</span>
                                </span>
                            </summary>
                            <MarkdownContent content={faq.answer_markdown} className="mt-4 text-slate-600" />
                        </details>
                    ))}
                </div>
            </section>

            <section id="disclaimer" className="border-y border-slate-900/10 bg-white/70 px-4 py-10">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-xl font-black">Disclaimer</h2>
                    <p className="mt-3 text-md leading-7 text-slate-600">
                        This system is for demo purposes only, created in fulfillment of the requirement for the degree of Bachelor of Science in Computer Science at the University of the Philippines Diliman.
                    </p>
                </div>
            </section>

            <footer className="bg-slate-950 px-4 py-10 text-slate-300">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm">© 2026 BUDGET System Demo. All rights reserved.</p>
                    <div className="flex flex-col gap-1 text-sm md:text-right">
                        <p>Denise Dee • dbdee@up.edu.ph</p>
                        <p>Carl Geevee Vitug • cdvitug@up.edu.ph</p>
                    </div>
                </div>
            </footer>
        </main>
    )
}
