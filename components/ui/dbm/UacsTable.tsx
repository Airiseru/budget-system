'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Pencil, Plus, CircleOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    UacsFundingSource,
    UacsLocation,
    UacsObjectCode,
} from '@/src/types/uacs'

type Tab = 'funding_source' | 'location' | 'object_code'

type Props = {
    fundingSources: UacsFundingSource[]
    locations: UacsLocation[]
    objectCodes: UacsObjectCode[]
}

const TAB_LABELS: Record<Tab, string> = {
    funding_source: 'Funding Sources',
    location: 'Locations',
    object_code: 'Object Codes',
}

export function UacsTable({ fundingSources, locations, objectCodes }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('funding_source')

    const rows = useMemo(() => {
        if (activeTab === 'funding_source') {
            return fundingSources.map((row) => ({
                code: row.code,
                description: row.description,
                hierarchy: `${row.cluster_code} / ${row.financing_code} / ${row.auth_code} / ${row.category_code}`,
                status: row.status,
            }))
        }

        if (activeTab === 'location') {
            return locations.map((row) => ({
                code: row.code,
                description: row.description,
                hierarchy: `${row.region_code} / ${row.province_code} / ${row.city_municipality_code} / ${row.brgy_code}`,
                status: row.status,
            }))
        }

        return objectCodes.map((row) => ({
            code: row.code,
            description: row.description,
            hierarchy: `${row.chart_account_code} / ${row.sub_object_code}`,
            status: row.status,
        }))
    }, [activeTab, fundingSources, locations, objectCodes])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex gap-1">
                    {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab
                                    ? 'bg-accent-foreground text-white'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                            {TAB_LABELS[tab]}
                        </button>
                    ))}
                </div>

                <Link href={`/dbm/uacs/new?category=${activeTab}`}>
                    <Button className="gap-2 bg-accent-foreground text-white hover:bg-accent-foreground/90">
                        <Plus className="h-4 w-4" />
                        New Code
                    </Button>
                </Link>
            </div>

            <div className="border border-border rounded-md overflow-hidden py-2 px-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Hierarchy</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                    No UACS codes found.
                                </TableCell>
                            </TableRow>
                        ) : rows.map((row) => (
                            <TableRow key={row.code}>
                                <TableCell className="font-mono text-sm">{row.code}</TableCell>
                                <TableCell className="max-w-md whitespace-normal break-words align-center">
                                    {row.description}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{row.hierarchy}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={row.status === 'inactive' ? 'destructive' : 'secondary'}
                                        className={row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : ''}
                                    >
                                        {row.status.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon">
                                        <Link href={`/dbm/uacs/${activeTab}/${encodeURIComponent(row.code)}/edit`}>
                                            <Pencil className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" size="icon" disabled={row.status === 'inactive'}>
                                        <Link href={`/dbm/uacs/${activeTab}/${encodeURIComponent(row.code)}/inactivate`}>
                                            <CircleOff className="h-4 w-4 text-destructive" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
