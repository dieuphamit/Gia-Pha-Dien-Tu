'use client';

import { useEffect, useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchFamily, fetchPeopleForSelect, updateFamilyChildren } from '@/lib/supabase-data';
import type { TreeFamily } from '@/lib/supabase-data';
import { useAuth } from '@/components/auth-provider';

interface ChildItem {
    handle: string;
    label: string;
}

interface FamilyTab {
    family: TreeFamily;
    spouseName: string;
    children: ChildItem[];
}

interface Props {
    open: boolean;
    onClose: () => void;
    personHandle: string;
    familyHandles: string[];
    onSaved?: () => void;
}

// --- Sortable row ---

interface SortableRowProps {
    item: ChildItem;
    index: number;
    total: number;
    onMoveUp: () => void;
    onMoveDown: () => void;
}

function SortableRow({ item, index, total, onMoveUp, onMoveDown }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.handle,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/50 select-none"
        >
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
                tabIndex={-1}
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <span className="flex-1 text-sm">{item.label}</span>
            <div className="flex gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={onMoveUp}
                >
                    <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === total - 1}
                    onClick={onMoveDown}
                >
                    <ChevronDown className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// --- Main dialog ---

export function ReorderChildrenDialog({ open, onClose, personHandle, familyHandles, onSaved }: Props) {
    const { user } = useAuth();
    const [tabs, setTabs] = useState<FamilyTab[]>([]);
    const [pendingOrders, setPendingOrders] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    useEffect(() => {
        if (!open || familyHandles.length === 0) return;
        setLoading(true);
        setError('');
        setPendingOrders({});

        Promise.all([
            Promise.all(familyHandles.map(h => fetchFamily(h))),
            fetchPeopleForSelect(),
        ]).then(([families, allPeople]) => {
            const nameMap = new Map(allPeople.map(p => [p.handle, p.displayName]));

            const built: FamilyTab[] = [];
            for (const fam of families) {
                if (!fam) continue;
                const spouseHandle = fam.fatherHandle === personHandle
                    ? fam.motherHandle
                    : fam.fatherHandle;
                const spouseName = spouseHandle ? (nameMap.get(spouseHandle) ?? spouseHandle) : '';
                const children: ChildItem[] = fam.children.map(ch => ({
                    handle: ch,
                    label: nameMap.get(ch) ?? ch,
                }));
                built.push({ family: fam, spouseName, children });
            }
            setTabs(built);
            setLoading(false);
        }).catch(() => {
            setError('Không thể tải dữ liệu gia đình.');
            setLoading(false);
        });
    }, [open, familyHandles, personHandle]);

    function getChildren(familyHandle: string): ChildItem[] {
        if (pendingOrders[familyHandle]) {
            const tab = tabs.find(t => t.family.handle === familyHandle);
            if (!tab) return [];
            const map = new Map(tab.children.map(c => [c.handle, c]));
            return pendingOrders[familyHandle].map(h => map.get(h)!).filter(Boolean);
        }
        return tabs.find(t => t.family.handle === familyHandle)?.children ?? [];
    }

    function setOrder(familyHandle: string, newOrder: ChildItem[]) {
        setPendingOrders(prev => ({
            ...prev,
            [familyHandle]: newOrder.map(c => c.handle),
        }));
    }

    function handleDragEnd(familyHandle: string, event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const children = getChildren(familyHandle);
        const oldIndex = children.findIndex(c => c.handle === active.id);
        const newIndex = children.findIndex(c => c.handle === over.id);
        setOrder(familyHandle, arrayMove(children, oldIndex, newIndex));
    }

    function moveItem(familyHandle: string, index: number, direction: -1 | 1) {
        const children = getChildren(familyHandle);
        setOrder(familyHandle, arrayMove(children, index, index + direction));
    }

    async function handleSave() {
        if (Object.keys(pendingOrders).length === 0) return;
        setSaving(true);
        setError('');
        try {
            await Promise.all(
                Object.entries(pendingOrders).map(([familyHandle, order]) =>
                    updateFamilyChildren(familyHandle, order, user?.id)
                )
            );
            onSaved?.();
            onClose();
        } catch {
            setError('Lưu thất bại. Vui lòng thử lại.');
        } finally {
            setSaving(false);
        }
    }

    const hasChanges = Object.keys(pendingOrders).length > 0;

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowUpDown className="h-4 w-4" />
                        Sắp xếp con cái
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <p className="text-sm text-muted-foreground text-center py-6">Đang tải...</p>
                )}

                {!loading && tabs.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Không có con cái.</p>
                )}

                {!loading && tabs.length > 0 && (
                    <Tabs defaultValue={tabs[0].family.handle}>
                        <TabsList className="w-full">
                            {tabs.map((tab, i) => (
                                <TabsTrigger key={tab.family.handle} value={tab.family.handle} className="flex-1 truncate">
                                    {tab.spouseName || `Gia đình ${i + 1}`}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {tabs.map(tab => {
                            const children = getChildren(tab.family.handle);
                            return (
                                <TabsContent key={tab.family.handle} value={tab.family.handle} className="mt-3">
                                    {children.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Gia đình này chưa có con.
                                        </p>
                                    )}
                                    {children.length > 0 && (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={e => handleDragEnd(tab.family.handle, e)}
                                        >
                                            <SortableContext
                                                items={children.map(c => c.handle)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="flex flex-col gap-1">
                                                    {children.map((child, idx) => (
                                                        <SortableRow
                                                            key={child.handle}
                                                            item={child}
                                                            index={idx}
                                                            total={children.length}
                                                            onMoveUp={() => moveItem(tab.family.handle, idx, -1)}
                                                            onMoveDown={() => moveItem(tab.family.handle, idx, 1)}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    )}
                                </TabsContent>
                            );
                        })}
                    </Tabs>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Hủy
                    </Button>
                    <Button onClick={handleSave} disabled={!hasChanges || saving}>
                        {saving ? 'Đang lưu...' : 'Lưu thứ tự'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
