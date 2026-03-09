'use client';

import { cn } from '@/lib/utils';

interface Clan {
    handle: string;
    displayName: string;
}

interface Props {
    clans: Clan[];
    selected: string[];
    onChange: (selected: string[]) => void;
    /** Label shown above the group */
    label?: string;
}

/**
 * Inline multi-select clan picker using card-style checkboxes.
 * Replaces native <select> for admin clan assignment on people.
 */
export function ClanCheckboxGroup({ clans, selected, onChange, label = 'Dòng họ' }: Props) {
    function toggle(handle: string) {
        const next = selected.includes(handle)
            ? selected.filter(h => h !== handle)
            : [...selected, handle];
        onChange(next);
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">{label}</p>
            <div className="flex flex-wrap gap-2">
                {clans.map((clan) => {
                    const checked = selected.includes(clan.handle);
                    return (
                        <button
                            key={clan.handle}
                            type="button"
                            onClick={() => toggle(clan.handle)}
                            className={cn(
                                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                                checked
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
                            )}
                        >
                            {/* Checkmark dot */}
                            <span className={cn(
                                'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                                checked ? 'border-primary-foreground bg-primary-foreground/20' : 'border-current',
                            )}>
                                {checked && (
                                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                                )}
                            </span>
                            {clan.displayName}
                        </button>
                    );
                })}
            </div>
            {selected.length === 0 && (
                <p className="text-xs text-destructive">Vui lòng chọn ít nhất một dòng họ.</p>
            )}
        </div>
    );
}
