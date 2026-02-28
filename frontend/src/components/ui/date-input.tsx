'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DateInputProps {
    value: string; // ISO "YYYY-MM-DD" or ""
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

/** Format an ISO date string "YYYY-MM-DD" → "DD/MM/YYYY" without timezone conversion. */
export function formatDateVN(iso: string | undefined | null): string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function parseISO(iso: string): { d: string; m: string; y: string } {
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-');
        return { d, m, y };
    }
    return { d: '', m: '', y: '' };
}

function buildISO(d: string, m: string, y: string): string {
    if (!d || !m || !y || y.length < 4) return '';
    const dd = d.padStart(2, '0');
    const mm = m.padStart(2, '0');
    const iso = `${y}-${mm}-${dd}`;
    // Validate: re-parse and compare to catch invalid dates like 31/02
    const [yr, mo, dy] = iso.split('-').map(Number);
    const date = new Date(yr, mo - 1, dy);
    if (date.getFullYear() !== yr || date.getMonth() + 1 !== mo || date.getDate() !== dy) return '';
    return iso;
}

/**
 * Date input showing DD / MM / YYYY with auto-advance between fields.
 * Internally stores and emits ISO "YYYY-MM-DD" format.
 */
export function DateInput({ value, onChange, className, disabled }: DateInputProps) {
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');

    const dayRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);

    // Sync from external value prop
    useEffect(() => {
        const { d, m, y } = parseISO(value);
        setDay(d);
        setMonth(m);
        setYear(y);
    }, [value]);

    const emit = useCallback((d: string, m: string, y: string) => {
        const iso = buildISO(d, m, y);
        if (iso) {
            onChange(iso);
        } else if (!d && !m && !y) {
            onChange('');
        }
        // Partial input → keep previous external value, don't emit
    }, [onChange]);

    const handleDay = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 2);
        const clamped = v && Number(v) > 31 ? '31' : v;
        setDay(clamped);
        emit(clamped, month, year);
        if (clamped.length === 2) monthRef.current?.focus();
    };

    const handleMonth = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 2);
        const clamped = v && Number(v) > 12 ? '12' : v;
        setMonth(clamped);
        emit(day, clamped, year);
        if (clamped.length === 2) yearRef.current?.focus();
    };

    const handleYear = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
        setYear(v);
        emit(day, month, v);
    };

    const seg = 'w-6 text-center bg-transparent outline-none p-0 focus:ring-0 border-none';

    return (
        <div
            className={cn(
                'flex items-center border rounded-md px-2 py-1.5 text-sm bg-background',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
                disabled && 'opacity-50 cursor-not-allowed',
                className,
            )}
        >
            <input
                ref={dayRef}
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="DD"
                value={day}
                disabled={disabled}
                className={seg}
                onChange={handleDay}
            />
            <span className="text-muted-foreground select-none">/</span>
            <input
                ref={monthRef}
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                value={month}
                disabled={disabled}
                className={seg}
                onChange={handleMonth}
                onKeyDown={e => { if (e.key === 'Backspace' && !month) dayRef.current?.focus(); }}
            />
            <span className="text-muted-foreground select-none">/</span>
            <input
                ref={yearRef}
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                value={year}
                disabled={disabled}
                className="w-10 text-center bg-transparent outline-none p-0 focus:ring-0 border-none"
                onChange={handleYear}
                onKeyDown={e => { if (e.key === 'Backspace' && !year) monthRef.current?.focus(); }}
            />
        </div>
    );
}
