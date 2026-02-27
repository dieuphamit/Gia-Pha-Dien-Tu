/**
 * Tests cho email.ts — birthday email utility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, calcAge } from './email';

// ── formatDate ────────────────────────────────────────────────
describe('formatDate', () => {
    it('formats an ISO date to Vietnamese dd/mm/yyyy format', () => {
        const result = formatDate('1985-07-15');
        expect(result).toBe('15/07/1985');
    });

    it('pads day and month with leading zero', () => {
        const result = formatDate('2000-01-05');
        expect(result).toBe('05/01/2000');
    });

    it('formats December 31 correctly', () => {
        const result = formatDate('1990-12-31');
        expect(result).toBe('31/12/1990');
    });
});

// ── calcAge ───────────────────────────────────────────────────
describe('calcAge', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('calculates correct age when birthday has already passed this year', () => {
        // Freeze time to 2026-02-28
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-28'));

        // Born 1990-01-01 → birthday passed → 36 years old
        expect(calcAge('1990-01-01')).toBe(36);
    });

    it('calculates correct age on the exact birthday', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-28'));

        // Born 1990-02-28 → exactly 36 today
        expect(calcAge('1990-02-28')).toBe(36);
    });

    it('calculates correct age when birthday has NOT yet occurred this year', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-28'));

        // Born 1990-12-01 → birthday not yet in 2026 → still 35
        expect(calcAge('1990-12-01')).toBe(35);
    });

    it('returns 0 for a baby born this year before today', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-28'));

        expect(calcAge('2026-01-01')).toBe(0);
    });
});
