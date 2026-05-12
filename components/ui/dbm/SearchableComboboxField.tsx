'use client'

import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from '@/components/ui/combobox'

export type SearchableComboboxOption = {
    value: string
    label: string
}

type Props = {
    items: SearchableComboboxOption[]
    value: string
    placeholder: string
    searchPlaceholder: string
    emptyText: string
    disabled?: boolean
    onValueChange: (value: string) => void
}

export default function SearchableComboboxField({
    items,
    value,
    placeholder,
    searchPlaceholder,
    emptyText,
    disabled = false,
    onValueChange,
}: Props) {
    const selectedItem = items.find((item) => item.value === value) ?? null

    return (
        <Combobox
            items={items}
            value={selectedItem}
            disabled={disabled}
            onValueChange={(item) => onValueChange(item?.value ?? '')}
            isItemEqualToValue={(item, selected) => item.value === selected.value}
        >
            <ComboboxTrigger
                disabled={disabled}
                render={
                    <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-12 w-full justify-between gap-2 overflow-hidden px-3 py-3 text-md disabled:cursor-not-allowed disabled:opacity-60 disabled:border-gray-500 disabled:text-gray-500 disabled:cursor-not-allowed"
                        disabled={disabled}
                    >
                        <span className="min-w-0 flex-1 overflow-hidden">
                            <ComboboxValue placeholder={placeholder}>
                                {(selected) => (
                                    <span className="block min-w-0 truncate text-left">
                                        {selected?.label ?? placeholder}
                                    </span>
                                )}
                            </ComboboxValue>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                }
            />
            <ComboboxContent className="w-[min(var(--anchor-width),42rem)] min-w-[var(--anchor-width)] max-w-[min(90vw,42rem)]">
                <ComboboxInput showTrigger={false} placeholder={searchPlaceholder} disabled={disabled} />
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                <ComboboxList>
                    {(item: SearchableComboboxOption) => (
                        <ComboboxItem
                            key={item.value}
                            value={item}
                            className="items-start whitespace-normal break-words"
                        >
                            <span className="block whitespace-normal break-words text-left">
                                {item.label}
                            </span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}
