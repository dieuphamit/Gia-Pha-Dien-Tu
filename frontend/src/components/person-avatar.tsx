'use client';

/**
 * PersonAvatar — Reusable avatar component for genealogy people.
 * Displays person's photo if available, otherwise falls back to initials circle.
 */

const SIZE_MAP = {
    sm:  { px: 28,  text: 'text-[9px]',  font: 'font-bold' },
    md:  { px: 44,  text: 'text-sm',     font: 'font-bold' },
    lg:  { px: 80,  text: 'text-xl',     font: 'font-bold' },
    xl:  { px: 120, text: 'text-3xl',    font: 'font-bold' },
} as const;

type AvatarSize = keyof typeof SIZE_MAP;

interface PersonAvatarProps {
    avatarUrl?: string | null;
    displayName: string;
    gender?: number;       // 1=Male, 2=Female
    isPatrilineal?: boolean;
    isLiving?: boolean;
    size?: AvatarSize;
    className?: string;
}

function getInitials(displayName: string): string {
    const parts = displayName.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
}

function getAvatarBg(gender: number, isPatrilineal: boolean, isLiving: boolean): string {
    const isDead = !isLiving;
    if (!isPatrilineal) return 'bg-stone-300 text-stone-600';
    if (gender === 1) return isDead ? 'bg-indigo-300 text-indigo-800' : 'bg-indigo-400 text-white';
    if (gender === 2) return isDead ? 'bg-rose-300 text-rose-800' : 'bg-rose-400 text-white';
    return 'bg-slate-300 text-slate-600';
}

export function PersonAvatar({
    avatarUrl,
    displayName,
    gender = 1,
    isPatrilineal = true,
    isLiving = true,
    size = 'md',
    className = '',
}: PersonAvatarProps) {
    const { px, text, font } = SIZE_MAP[size];
    const initials = getInitials(displayName);
    const bgClass = getAvatarBg(gender, isPatrilineal, isLiving);

    const containerStyle: React.CSSProperties = {
        width: px,
        height: px,
        minWidth: px,
        minHeight: px,
    };

    if (avatarUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={avatarUrl}
                alt={displayName}
                className={`rounded-full object-cover ring-2 ring-white shadow-md ${!isLiving ? 'opacity-70 grayscale' : ''} ${className}`}
                style={containerStyle}
                loading="lazy"
            />
        );
    }

    return (
        <div
            className={`rounded-full flex items-center justify-center shadow-sm ring-1 ring-black/10 ${bgClass} ${font} ${text} ${!isLiving ? 'opacity-70' : ''} ${className}`}
            style={containerStyle}
        >
            {initials}
        </div>
    );
}
