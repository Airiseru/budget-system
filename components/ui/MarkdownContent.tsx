import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
    content: string
    className?: string
}

function safeHref(href: string) {
    const trimmed = href.trim()
    if (
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('mailto:')
    ) {
        return trimmed
    }

    return '#'
}

function renderInline(text: string): ReactNode[] {
    const parts: ReactNode[] = []
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
    let cursor = 0

    for (const match of text.matchAll(pattern)) {
        const index = match.index ?? 0
        if (index > cursor) {
            parts.push(text.slice(cursor, index))
        }

        const token = match[0]
        const key = `${index}-${token}`
        if (token.startsWith('**') && token.endsWith('**')) {
            parts.push(<strong key={key}>{token.slice(2, -2)}</strong>)
        } else if (token.startsWith('*') && token.endsWith('*')) {
            parts.push(<em key={key}>{token.slice(1, -1)}</em>)
        } else {
            const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
            if (linkMatch) {
                parts.push(
                    <Link
                        key={key}
                        href={safeHref(linkMatch[2])}
                        className="font-semibold underline underline-offset-4"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {linkMatch[1]}
                    </Link>
                )
            } else {
                parts.push(token)
            }
        }

        cursor = index + token.length
    }

    if (cursor < text.length) {
        parts.push(text.slice(cursor))
    }

    return parts
}

export default function MarkdownContent({ content, className }: Props) {
    const lines = content.replace(/\r\n/g, '\n').split('\n')
    const nodes: ReactNode[] = []
    let listItems: string[] = []
    let listType: 'ul' | 'ol' = 'ul'

    const flushList = () => {
        if (listItems.length === 0) return
        const ListTag = listType
        nodes.push(
            <ListTag key={`${listType}-${nodes.length}`} className={`my-3 space-y-1 pl-5 ${listType === 'ul' ? 'list-disc' : 'list-decimal'}`}>
                {listItems.map((item, index) => (
                    <li key={`${item}-${index}`}>{renderInline(item)}</li>
                ))}
            </ListTag>
        )
        listItems = []
        listType = 'ul'
    }

    lines.forEach((line, index) => {
        const trimmed = line.trim()

        if (!trimmed) {
            flushList()
            return
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (listType !== 'ul') flushList()
            listType = 'ul'
            listItems.push(trimmed.slice(2).trim())
            return
        }

        const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
        if (orderedMatch) {
            if (listType !== 'ol') flushList()
            listType = 'ol'
            listItems.push(orderedMatch[1].trim())
            return
        }

        flushList()

        if (trimmed.startsWith('### ')) {
            nodes.push(
                <h3 key={index} className="mt-4 text-base font-bold text-secondary-foreground">
                    {renderInline(trimmed.slice(4))}
                </h3>
            )
            return
        }

        if (trimmed.startsWith('## ')) {
            nodes.push(
                <h3 key={index} className="mt-4 text-lg font-bold text-secondary-foreground">
                    {renderInline(trimmed.slice(3))}
                </h3>
            )
            return
        }

        nodes.push(
            <p key={index} className="my-3 leading-7">
                {renderInline(trimmed)}
            </p>
        )
    })

    flushList()

    return (
        <div className={cn('text-sm text-muted-foreground', className)}>
            {nodes.length > 0 ? nodes : <p>No content provided.</p>}
        </div>
    )
}
