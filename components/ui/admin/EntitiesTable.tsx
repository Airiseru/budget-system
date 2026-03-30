'use client'

import { Department, Agency, OperatingUnit } from '@/src/types/entities'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Props = {
    departments: Partial<Department[]>
    agencies: Partial<Agency[]>
    operatingUnits: Partial<OperatingUnit[]>
    entityName: string
}

type Row = {
    id: string
    name: string
    abbr: string
    uacs_code: string
    type: string
    badge: string
    parent: string
    editUrl: string
    deleteUrl: string
}

export function EntitiesTable({ departments, agencies, operatingUnits, entityName }: Props) {
    // mapping of department id to agencies
    const agenciesByDeptId = new Map<string | null, Agency[]>()

    // mapping of agency id to operating units
    const ousByAgencyId = new Map<string, OperatingUnit[]>()

    agencies?.forEach(agency => {
        if (!agency) return
        const key = agency.department_id ?? null // null key for independent agencies
        if (!agenciesByDeptId.has(key)) agenciesByDeptId.set(key, []) // create empty array if it doesn't exist
        agenciesByDeptId.get(key)!.push(agency)
    })

    operatingUnits?.forEach(ou => {
        if (!ou || !ou.agency_id) return
        if (!ousByAgencyId.has(ou.agency_id)) ousByAgencyId.set(ou.agency_id, []) // create empty array if it doesn't exist
        ousByAgencyId.get(ou.agency_id)!.push(ou)
    })

    const rows: Row[] = []

    // helper to add an agency and its operating units
    function addAgency(agency: Agency, parentName: string) {
        rows.push({
            id: agency.id,
            name: agency.name,
            abbr: agency.abbr ? ` (${agency.abbr})` : '',
            uacs_code: agency.uacs_code,
            type: agency.type === 'bureau' ? 'Bureau' : 'Attached Agency',
            badge: 'secondary',
            parent: parentName,
            editUrl: `/admin/entities/agency/${agency.id}/edit`,
            deleteUrl: `/admin/entities/agency/${agency.id}/delete`,
        })

        ousByAgencyId.get(agency.id)?.forEach(ou => {
            rows.push({
                id: ou.id,
                name: ou.name,
                abbr: ou.abbr ? ` (${ou.abbr})` : '',
                uacs_code: ou.uacs_code,
                type: 'Operating Unit',
                badge: 'outline',
                parent: agency.name,
                editUrl: `/admin/entities/operating-unit/${ou.id}/edit`,
                deleteUrl: `/admin/entities/operating-unit/${ou.id}/delete`,
            })
        })
    }

    // departments and their children
    departments?.forEach(dept => {
        if (!dept) return
        rows.push({
            id: dept.id,
            name: dept.name,
            abbr: dept.abbr ? ` (${dept.abbr})` : '',
            uacs_code: dept.uacs_code,
            type: 'Department',
            badge: 'default',
            parent: '—',
            editUrl: `/admin/entities/department/${dept.id}/edit`,
            deleteUrl: `/admin/entities/department/${dept.id}/delete`,
        })
        agenciesByDeptId.get(dept.id)?.forEach(agency => addAgency(agency, dept.name))
    })

    // agencies under the department
    if (!departments || departments.filter(Boolean).length === 0) {
        agenciesByDeptId.forEach((deptAgencies, deptId) => {
            if (deptId === null) return  // independent agencies handled separately
            deptAgencies.forEach(agency => addAgency(agency, entityName))
        })
    }

    // independent agencies (no department)
    agenciesByDeptId.get(null)?.forEach(agency => addAgency(agency, 'Independent'))

    // operating units with no agency in the list (agency-level admin)
    // add any OUs that weren't already added via addAgency
    const addedOuIds = new Set(rows.filter(r => r.type === 'Operating Unit').map(r => r.id))
    operatingUnits?.forEach(ou => {
        if (!ou || addedOuIds.has(ou.id)) return
        rows.push({
            id: ou.id,
            name: ou.name,
            abbr: ou.abbr ? ` (${ou.abbr})` : '',
            uacs_code: ou.uacs_code,
            type: 'Operating Unit',
            badge: 'outline',
            parent: '—',
            editUrl: `/admin/entities/operating-unit/${ou.id}/edit`,
            deleteUrl: `/admin/entities/operating-unit/${ou.id}/delete`,
        })
    })

    if (rows.length === 0) {
        return (
            <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                No entities found.
            </div>
        )
    }

    return (
        <div className="border border-border rounded-md overflow-hidden">
            <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>UACS Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Under</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map(row => (
                            <TableRow key={row.id}>
                                <TableCell className="font-medium">{row.name}{row.abbr}</TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">{row.uacs_code}</TableCell>
                                <TableCell>
                                    <Badge variant={row.badge as 'default' | 'secondary' | 'outline'}>
                                        {row.type}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{row.parent}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={row.editUrl}>
                                        <Button variant="ghost" size="icon">
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                    <Link href={row.deleteUrl}>
                                        <Button variant="ghost" size="icon">
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}