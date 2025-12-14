export type FuzzyDate = { year: number; month: number; day: number };

export type MediaListEntry = {
    id: number;
    mediaId: number;
    createdAt: number;
    customLists: Record<string, boolean> | null;
    advancedScores: Record<string, number> | null;
    notes: string | null;
    private: boolean;
    repeat: number;
    progressVolumes: number;
    progress: number;
    updatedAt: number;
    status: string;
    score: number;
    userId: number;
    startedAt: FuzzyDate | null;
    completedAt: FuzzyDate | null;
    media: { id: number; type: string } | null;
};

export type ActivityEntry = {
    createdAt: number;
    id: number;
    likeCount: number;
    progress: string;
    userId: number;
    type: string;
    status: string;
    isLocked: boolean;
    replyCount: number;
    media: { id: number; type: string } | null;
};

export type GdprUser = {
    display_name: string;
    about: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    custom_lists: {
        anime: string[];
        manga: string[];
    };
    advanced_scores: {
        active: boolean;
        names: string[];
    };
};

export type GdprListEntry = {
    id: number;
    series_type: number;
    user_id: number;
    series_id: number;
    status: number;
    score: number;
    progress: number;
    progress_volume: number;
    priority: number;
    repeat: number;
    private: number;
    notes: string | null;
    custom_lists: string[];
    advanced_scores: number[];
    hidden_default: number;
    started_on: number;
    finished_on: number;
    created_at: string;
    updated_at: string;
};

export type GdprActivityEntry = {
    id: number;
    user_id: number;
    messenger_id: number | null;
    action_type: number;
    object_id: number;
    object_type: number;
    object_value: string;
    reply_count: number;
    created_at: string;
    updated_at: string;
    locked: number;
    like_count: number;
    private: number;
};

export type ExportOutput = {
    user: GdprUser;
    lists: GdprListEntry[];
    activity: GdprActivityEntry[];
};
