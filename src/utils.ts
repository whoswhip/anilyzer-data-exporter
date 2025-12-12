import type { FuzzyDate, MediaListEntry } from './types.ts';

export const MediaType = {
    ANIME: 0,
    MANGA: 1,
} as const;

export const mediaListStatusMap = {
    CURRENT: 0,
    PLANNING: 1,
    COMPLETED: 2,
    DROPPED: 3,
    PAUSED: 4,
    REPEATING: 5,
} as const;

export const actionTypeMap = {
    completed: 1,
    plans: 2,
    dropped: 5,
    paused: 4,
    rewatched: 6,
    reread: 6,
    watched: 3,
    read: 3,
} as const;

export function unixSecondsToTimestamp(seconds: number): string {
    const date = new Date(seconds * 1000);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mi = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function fuzzyDateToNumber(value: FuzzyDate | null): number {
    if (!value?.year || !value.month || !value.day) {
        return 0;
    }
    return value.year * 10000 + value.month * 100 + value.day;
}

export function mediaTypeToSeriesType(mediaType: string | null): number {
    return mediaType === 'MANGA' ? MediaType.MANGA : MediaType.ANIME;
}

export function mediaListStatusToNumber(status: string): number {
    return (mediaListStatusMap as Record<string, number>)[status] ?? 0;
}

export function extractTrueKeys(value: Record<string, boolean> | null): string[] {
    if (!value) return [];
    return Object.entries(value)
        .filter(([, isActive]) => Boolean(isActive))
        .map(([name]) => name);
}

export function actionTypeFromActivityStatus(status: string): number {
    if (!status) {
        return 0;
    }
    const normalized = status.toLowerCase();
    for (const [key, value] of Object.entries(actionTypeMap)) {
        if (normalized.includes(key)) {
            return value;
        }
    }
    return 0;
}

export function buildAdvancedScoreNames(entries: MediaListEntry[]): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const entry of entries) {
        if (!entry.advancedScores) continue;
        for (const key of Object.keys(entry.advancedScores)) {
            if (seen.has(key)) continue;
            seen.add(key);
            names.push(key);
        }
    }
    return names;
}

export function mapAdvancedScores(entry: MediaListEntry, orderedNames: string[]): number[] {
    if (!entry.advancedScores || orderedNames.length === 0) return [];
    return orderedNames.map((name) => entry.advancedScores?.[name] ?? 0);
}
