'use client'

import { useState } from 'react'
import { Department, Agency, OperatingUnit } from '@/src/types/entities'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, CircleOff, Pencil } from 'lucide-react'
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
    parentDepartmentId: string | null
    editUrl: string
    deactivateUrl: string
}

function getEntityStatusBadgeClass(status: string) {
    if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    if (status === 'inactive') return 'border-red-200 bg-red-50 text-red-700'
    return 'border-border bg-muted text-muted-foreground'
}

export function EntityManagementTable({ departments, agencies, operatingUnits, entityName, basePath = '/dbm/entities', showActions = true }: Props) {
    const [collapsedDepartmentIds, setCollapsedDepartmentIds] = useState<Set<string>>(new Set())
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

    function toggleDepartment(departmentId: string) {
        setCollapsedDepartmentIds((current) => {
            const next = new Set(current)
            if (next.has(departmentId)) next.delete(departmentId)
            else next.add(departmentId)
            return next
        })
    }

    function addOperatingUnit(ou: OperatingUnitOption, parentName: string, depth: number, parentDepartmentId: string | null) {
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
            parentDepartmentId,
            editUrl: `${basePath}/operating-unit/${ou.id}/edit`,
            deactivateUrl: `${basePath}/operating-unit/${ou.id}/deactivate`,
        })

        ousByParentId.get(ou.id)?.forEach(childOu => addOperatingUnit(childOu, ou.name, depth + 1, parentDepartmentId))
    }

    function addAgency(agency: AgencyOption, parentName: string, depth = 0, parentDepartmentId: string | null = null) {
        rows.push({
            id: agency.id,
            name: agency.name,
            abbr: agency.abbr ? ` (${agency.abbr})` : '',
            uacs_code: agency.uacs_code,
            type: agency.type === 'bureau' ? 'Bureau' : 'Attached Agency',
            badge: 'secondary',
            status: agency.status ?? 'active',
            parent: parentName,
            depth,
            parentDepartmentId,
            editUrl: `${basePath}/agency/${agency.id}/edit`,
            deactivateUrl: `${basePath}/agency/${agency.id}/deactivate`,
        })

        operatingUnits
            ?.filter(ou => ou?.agency_id === agency.id && !ou?.parent_ou_id)
            .forEach(ou => {
                if (ou) addOperatingUnit(ou, agency.name, depth + 1, parentDepartmentId)
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
            parentDepartmentId: dept.id,
            editUrl: `${basePath}/department/${dept.id}/edit`,
            deactivateUrl: `${basePath}/department/${dept.id}/deactivate`,
        })
        agenciesByDeptId.get(dept.id)?.forEach(agency => addAgency(agency, dept.name, 1, dept.id))
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
            parentDepartmentId: null,
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
                        {rows.filter((row) => !row.parentDepartmentId || row.type === 'Department' || !collapsedDepartmentIds.has(row.parentDepartmentId)).map(row => (
                            <TableRow key={row.id}>
                                <TableCell className="font-medium max-w-md whitespace-normal break-words align-center" style={{ paddingLeft: `${16 + row.depth * 20}px` }}>
                                    <div className="flex items-center gap-2">
                                        {row.type === 'Department' ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleDepartment(row.id)}
                                                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-secondary-foreground"
                                                aria-label={collapsedDepartmentIds.has(row.id) ? 'Expand department' : 'Collapse department'}
                                            >
                                                {collapsedDepartmentIds.has(row.id)
                                                    ? <ChevronRight className="h-4 w-4" />
                                                    : <ChevronDown className="h-4 w-4" />}
                                            </button>
                                        ) : (
                                            <span className="w-6 text-center text-muted-foreground">
                                                {row.depth > 0 ? '↳' : ''}
                                            </span>
                                        )}
                                        <span>{row.name}{row.abbr}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">{row.uacs_code}</TableCell>
                                <TableCell>
                                    <Badge variant={row.badge as 'default' | 'secondary' | 'outline'}>
                                        {row.type}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={getEntityStatusBadgeClass(row.status)}>
                                        {row.status.toUpperCase()}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm max-w-md whitespace-normal break-words align-center">{row.parent}</TableCell>
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
