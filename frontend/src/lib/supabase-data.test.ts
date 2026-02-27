/**
 * Tests cho supabase-data.ts — birthDate sync logic
 */
import { describe, it, expect } from 'vitest';
import { buildPersonDbFields } from './supabase-data';

describe('buildPersonDbFields — birthDate sync', () => {
    it('sets birth_date and syncs birth_year from birthDate', () => {
        const result = buildPersonDbFields({ birthDate: '1985-07-15' });
        expect(result.birth_date).toBe('1985-07-15');
        expect(result.birth_year).toBe(1985);
    });

    it('sets death_date and syncs death_year from deathDate', () => {
        const result = buildPersonDbFields({ deathDate: '2020-03-22' });
        expect(result.death_date).toBe('2020-03-22');
        expect(result.death_year).toBe(2020);
    });

    it('sets birth_date to null without setting birth_year when birthDate is null', () => {
        const result = buildPersonDbFields({ birthDate: null });
        expect(result.birth_date).toBeNull();
        expect(result.birth_year).toBeUndefined();
    });

    it('sets death_date to null without setting death_year when deathDate is null', () => {
        const result = buildPersonDbFields({ deathDate: null });
        expect(result.death_date).toBeNull();
        expect(result.death_year).toBeUndefined();
    });

    it('does not set birth_date when birthDate is undefined', () => {
        const result = buildPersonDbFields({ displayName: 'Phạm Văn A' });
        expect(result.birth_date).toBeUndefined();
        expect(result.birth_year).toBeUndefined();
    });

    it('explicit birthYear overrides sync (legacy fallback)', () => {
        // Khi chỉ set birthYear mà không có birthDate
        const result = buildPersonDbFields({ birthYear: 1990 });
        expect(result.birth_year).toBe(1990);
        expect(result.birth_date).toBeUndefined();
    });

    it('birthDate takes precedence over birthYear for birth_year value', () => {
        // Khi có cả hai, birthDate.getFullYear() sẽ ghi đè birthYear
        const result = buildPersonDbFields({ birthYear: 1990, birthDate: '1985-06-01' });
        expect(result.birth_year).toBe(1985); // từ birthDate
        expect(result.birth_date).toBe('1985-06-01');
    });

    it('correctly maps camelCase fields to snake_case DB columns', () => {
        const result = buildPersonDbFields({
            displayName: 'Phạm Văn A',
            firstName: 'Văn A',
            surname: 'Phạm',
            nickName: 'Tèo',
            currentAddress: 'Hà Nội',
        });
        expect(result.display_name).toBe('Phạm Văn A');
        expect(result.first_name).toBe('Văn A');
        expect(result.surname).toBe('Phạm');
        expect(result.nick_name).toBe('Tèo');
        expect(result.current_address).toBe('Hà Nội');
    });

    it('handles January 1st date (default migration date)', () => {
        // Dữ liệu migrate: birth_year=1950 → birth_date='1950-01-01'
        const result = buildPersonDbFields({ birthDate: '1950-01-01' });
        expect(result.birth_date).toBe('1950-01-01');
        expect(result.birth_year).toBe(1950);
    });
});
