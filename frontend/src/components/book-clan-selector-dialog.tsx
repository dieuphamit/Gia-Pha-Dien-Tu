'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { BookOpen } from 'lucide-react';

interface Clan {
    handle: string;
    displayName: string;
}

interface Props {
    open: boolean;
    clans: Clan[];
    onSelect: (clanHandle: string) => void;
    onClose: () => void;
}

export function BookClanSelectorDialog({ open, clans, onSelect, onClose }: Props) {
    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Chọn dòng họ
                    </DialogTitle>
                </DialogHeader>
                <div className="flex flex-wrap gap-2 pt-2">
                    {clans.map((clan) => (
                        <button
                            key={clan.handle}
                            onClick={() => { onSelect(clan.handle); onClose(); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border
                                transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary
                                focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground flex items-center justify-center shrink-0" />
                            {clan.displayName}
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
