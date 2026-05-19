'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SearchableComboboxField, { type SearchableComboboxOption } from '@/components/ui/dbm/SearchableComboboxField'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { PapOption } from '@/src/db/postgres/repositories/papRepository'
import type { ItemCatalogOption } from '@/src/db/postgres/repositories/itemRepository'
import type {
    EntityOption,
    FundingSourceOption,
    LegislativeInsertionState,
} from './shared'
import { buildOrderedEntities, getEntityLabel } from './shared'

type Props = {
    open: boolean
    onClose: () => void
    value: LegislativeInsertionState
    onChange: (value: LegislativeInsertionState) => void
    paps: PapOption[]
    entities: EntityOption[]
    items: ItemCatalogOption[]
    fundingSources: FundingSourceOption[]
    loading: boolean
    error: string | null
    onSubmit: () => void
}

export default function LegislativeInsertionDialog({
    open,
    onClose,
    value,
    onChange,
    paps,
    entities,
    items,
    fundingSources,
    loading,
    error,
    onSubmit,
}: Props) {
    const FIELD_CLASSNAME = "h-12 w-full rounded-md border border-border bg-background px-3 py-2"
    const SELECT_TRIGGER_CLASSNAME = "h-auto min-h-12 w-full border-border px-3 py-3 text-md"
    const orderedEntities = buildOrderedEntities(entities)
    const sortedPaps = [...paps]
        .filter((pap) => {
            if (!['proposed', 'approved', 'for_release', 'on_going'].includes(pap.project_status)) return false
            if (!value.entity_id) return true
            return pap.entity_id === null || pap.entity_id === value.entity_id
        })
        .sort((a, b) => a.title.localeCompare(b.title))
    const sortedItems = [...items]
        .filter((item) => {
            if (item.scope === 'global') return true
            if (item.scope === 'entity') return !!value.entity_id && item.entity_id === value.entity_id
            return !!value.pap_code && item.pap_code === value.pap_code
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    const entityOptions: SearchableComboboxOption[] = orderedEntities.map((entity) => ({
        value: entity.id,
        label: getEntityLabel(entity),
    }))
    const papOptions: SearchableComboboxOption[] = sortedPaps.map((pap) => ({
        value: pap.id,
        label: pap.entity_name ? `${pap.title} • ${pap.entity_name}` : `${pap.title} • All entities`,
    }))
    const itemOptions: SearchableComboboxOption[] = sortedItems.map((item) => ({
        value: item.id,
        label: item.name,
    }))
    const fundingSourceOptions: SearchableComboboxOption[] = fundingSources.map((fund) => ({
        value: fund.code,
        label: fund.description ? `${fund.code} • ${fund.description}` : fund.code,
    }))

    if (!open) return null

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
            <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-[min(960px,calc(100vw-2rem))] rounded-2xl border border-border bg-background shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                    <div>
                        <h2 className="text-xl font-semibold text-secondary-foreground">Insert Legislative Line Item</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Add a new GAA line item with an origin tag of legislative insertion.
                        </p>
                    </div>
                    <Button type="button" variant="outline" size="icon-sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <p className="font-medium">Entity</p>
                            <SearchableComboboxField
                                items={entityOptions}
                                value={value.entity_id}
                                onValueChange={(next) =>
                                    onChange({
                                        ...value,
                                        entity_id: next,
                                        pap_code: '',
                                        item_catalog_id: '',
                                    })
                                }
                                placeholder="Select entity"
                                searchPlaceholder="Search entities"
                                emptyText="No entities found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">PAP</p>
                            <SearchableComboboxField
                                items={papOptions}
                                value={value.pap_code}
                                onValueChange={(next) =>
                                    onChange({
                                        ...value,
                                        pap_code: next,
                                        item_catalog_id: '',
                                    })
                                }
                                placeholder="Select PAP"
                                searchPlaceholder="Search PAPs"
                                emptyText="No PAPs found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Item Catalog</p>
                            <SearchableComboboxField
                                items={itemOptions}
                                value={value.item_catalog_id}
                                onValueChange={(next) => onChange({ ...value, item_catalog_id: next })}
                                placeholder="Select line item"
                                searchPlaceholder="Search line items"
                                emptyText="No line items found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Fund Source</p>
                            <SearchableComboboxField
                                items={fundingSourceOptions}
                                value={value.fund_code}
                                onValueChange={(next) => onChange({ ...value, fund_code: next })}
                                placeholder="Select fund source"
                                searchPlaceholder="Search fund sources"
                                emptyText="No fund sources found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Tier</p>
                            <Select
                                value={value.tier}
                                onValueChange={(next) => onChange({ ...value, tier: (next ?? '1') as '1' | '2' })}
                            >
                                <SelectTrigger className={SELECT_TRIGGER_CLASSNAME}>
                                    <SelectValue>{value.tier === '1' ? 'Tier 1' : 'Tier 2'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Tier 1</SelectItem>
                                    <SelectItem value="2">Tier 2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">GAA Amount</p>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={value.gaa_amt}
                                onChange={(event) => onChange({ ...value, gaa_amt: event.target.value })}
                                className={FIELD_CLASSNAME}
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Release Classification</p>
                            <Select
                                value={value.release_classification}
                                onValueChange={(next) => onChange({ ...value, release_classification: (next ?? 'FLR') as 'FLR' | 'FCR' })}
                            >
                                <SelectTrigger className={SELECT_TRIGGER_CLASSNAME}>
                                    <SelectValue>{value.release_classification === 'FLR' ? 'FLR - For Later Release' : 'FCR - Comprehensive Release'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FLR">FLR - For Later Release</SelectItem>
                                    <SelectItem value="FCR">FCR - Comprehensive Release</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Currency</p>
                            <input
                                value={value.currency}
                                onChange={(event) => onChange({ ...value, currency: event.target.value })}
                                className={FIELD_CLASSNAME}
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Valid From</p>
                            <input
                                type="date"
                                value={value.valid_from}
                                onChange={(event) => onChange({ ...value, valid_from: event.target.value })}
                                className={FIELD_CLASSNAME}
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Valid Until</p>
                            <input
                                type="date"
                                value={value.valid_until}
                                onChange={(event) => onChange({ ...value, valid_until: event.target.value })}
                                className={FIELD_CLASSNAME}
                            />
                        </div>
                    </div>

                    <div className="mt-4 space-y-2">
                        <p className="font-medium">Specific Description</p>
                        <textarea
                            value={value.specific_description}
                            onChange={(event) => onChange({ ...value, specific_description: event.target.value })}
                            className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
                        />
                    </div>

                    {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
                    <p className="text-sm text-muted-foreground">
                        This creates a new allocation tagged as a legislative insertion.
                    </p>
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={onSubmit}
                            disabled={loading}
                            className="bg-emerald-700 text-white hover:bg-emerald-700/90"
                        >
                            {loading ? 'Creating...' : 'Create Line Item'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
