'use client'

import { Department, Agency, OperatingUnit } from '@/src/types/entities'
import { Button } from '@/components/ui/button'
import { CircleOff, Pencil } from 'lucide-react'
import Link from 'next/link'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type DepartmentOption = Pick<Department, 'id' | 'name' | 'abbr' | 'uacs_code' | 'status'>
type AgencyOption = Pick<Agency, 'id' | 'name' | 'abbr' | 'uacs_code' | 'type' | 'department_id' | 'status'>
type OperatingUnitOption = Pick<OperatingUnit, 'id' | 'name' | 'abbr' | 'uacs_code' | 'agency_id' | 'parent_ou_id' | 'status'>

type Props = {
    departments: DepartmentOption[]
    agencies: AgencyOption[]
    operatingUnits: OperatingUnitOption[]
    entityName: string
    basePath?: string
    showActions?: boolean
}

type Row = {
    id: string
    name: string
    abbr: string
    uacs_code: string
    type: string
    badge: string
    status: string
    parent: string
    depth: number
    editUrl: string
    deactivateUrl: string
}

export function EntityManagementTable({ departments, agencies, operatingUnits, entityName, basePath = '/dbm/entities', showActions = true }: Props) {
    const agenciesByDeptId = new Map<string | null, AgencyOption[]>()
    const ousByParentId = new Map<string | null, OperatingUnitOption[]>()

    agencies?.forEach(agency => {
        if (!agency) return
        const key = agency.department_id ?? null
        if (!agenciesByDeptId.has(key)) agenciesByDeptId.set(key, [])
        agenciesByDeptId.get(key)!.push(agency)
    })

    operatingUnits?.forEach(ou => {
        if (!ou) return
        const key = ou.parent_ou_id ?? null
        if (!ousByParentId.has(key)) ousByParentId.set(key, [])
        ousByParentId.get(key)!.push(ou)
    })

    const rows: Row[] = []

    function addOperatingUnit(ou: OperatingUnitOption, parentName: string, depth: number) {
        rows.push({
            id: ou.id,
            name: ou.name,
            abbr: ou.abbr ? ` (${ou.abbr})` : '',
            uacs_code: ou.uacs_code,
            type: ou.parent_ou_id ? 'Lower-Level OU' : 'Operating Unit',
            badge: 'outline',
            status: ou.status ?? 'active',
            parent: parentName,
            depth,
            editUrl: `${basePath}/operating-unit/${ou.id}/edit`,
            deactivateUrl: `${basePath}/operating-unit/${ou.id}/deactivate`,
        })

        ousByParentId.get(ou.id)?.forEach(childOu => addOperatingUnit(childOu, ou.name, depth + 1))
    }

    function addAgency(agency: AgencyOption, parentName: string) {
        rows.push({
            id: agency.id,
            name: agency.name,
            abbr: agency.abbr ? ` (${agency.abbr})` : '',
            uacs_code: agency.uacs_code,
            type: agency.type === 'bureau' ? 'Bureau' : 'Attached Agency',
            badge: 'secondary',
            status: agency.status ?? 'active',
            parent: parentName,
            depth: 0,
            editUrl: `${basePath}/agency/${agency.id}/edit`,
            deactivateUrl: `${basePath}/agency/${agency.id}/deactivate`,
        })

        operatingUnits
            ?.filter(ou => ou?.agency_id === agency.id && !ou?.parent_ou_id)
            .forEach(ou => {
                if (ou) addOperatingUnit(ou, agency.name, 1)
            })
    }

    departments?.forEach(dept => {
        if (!dept) return
        rows.push({
            id: dept.id,
            name: dept.name,
            abbr: dept.abbr ? ` (${dept.abbr})` : '',
            uacs_code: dept.uacs_code,
            type: 'Department',
            badge: 'default',
            status: dept.status ?? 'active',
            parent: '—',
            depth: 0,
            editUrl: `${basePath}/department/${dept.id}/edit`,
            deactivateUrl: `${basePath}/department/${dept.id}/deactivate`,
        })
        agenciesByDeptId.get(dept.id)?.forEach(agency => addAgency(agency, dept.name))
    })

    if (!departments || departments.filter(Boolean).length === 0) {
        agenciesByDeptId.forEach((deptAgencies, deptId) => {
            if (deptId === null) return
            deptAgencies.forEach(agency => addAgency(agency, entityName))
        })
    }

    agenciesByDeptId.get(null)?.forEach(agency => addAgency(agency, 'Independent'))

    const addedOuIds = new Set(rows.map(row => row.id))
    operatingUnits?.forEach(ou => {
        if (!ou || addedOuIds.has(ou.id)) return
        rows.push({
            id: ou.id,
            name: ou.name,
            abbr: ou.abbr ? ` (${ou.abbr})` : '',
            uacs_code: ou.uacs_code,
            type: ou.parent_ou_id ? 'Lower-Level OU' : 'Operating Unit',
            badge: 'outline',
            status: ou.status ?? 'active',
            parent: '—',
            depth: ou.parent_ou_id ? 1 : 0,
            editUrl: `${basePath}/operating-unit/${ou.id}/edit`,
            deactivateUrl: `${basePath}/operating-unit/${ou.id}/deactivate`,
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
                            <TableHead>Status</TableHead>
                            <TableHead>Under</TableHead>
                            {showActions && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map(row => (
                            <TableRow key={row.id}>
                                <TableCell className="font-medium" style={{ paddingLeft: `${16 + row.depth * 20}px` }}>
                                    {row.depth > 0 ? '↳ ' : ''}
                                    {row.name}{row.abbr}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">{row.uacs_code}</TableCell>
                                <TableCell>
                                    <Badge variant={row.badge as 'default' | 'secondary' | 'outline'}>
                                        {row.type}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={row.status === 'inactive' ? 'destructive' : 'secondary'}
                                        className={row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : ''}
                                    >
                                        {row.status.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{row.parent}</TableCell>
                                {showActions && (
                                    <TableCell className="text-right">
                                        <Link href={row.editUrl}>
                                            <Button variant="ghost" size="icon" disabled={row.status === 'inactive'}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                        <Link href={row.deactivateUrl}>
                                            <Button variant="ghost" size="icon" disabled={row.status === 'inactive'}>
                                                <CircleOff className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
