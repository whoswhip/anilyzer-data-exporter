export const ActionType = {
    TEXT: 'TEXT',
    ANIME_LIST: 'ANIME_LIST',
    MANGA_LIST: 'MANGA_LIST',
    MESSAGE: 'MESSAGE',
    MEDIA_LIST: 'MEDIA_LIST',
} as const;

export const MediaListStatus = {
    CURRENT: 'CURRENT',
    PLANNING: 'PLANNING',
    COMPLETED: 'COMPLETED',
    DROPPED: 'DROPPED',
    PAUSED: 'PAUSED',
    REPEATING: 'REPEATING',
} as const;