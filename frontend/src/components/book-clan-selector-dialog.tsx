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
                <div className="space-y-2 pt-2">
                    {clans.map((clan) => (
                        <button
                            key={clan.handle}
                            onClick={() => { onSelect(clan.handle); onClose(); }}
                            className="w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium
                                transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                                {clan.displayName.charAt(0).toUpperCase()}
                            </span>
                            <span>Họ {clan.displayName}</span>
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
