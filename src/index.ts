#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { GraphQLClient } from 'graphql-request';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { userQuery, mediaListQuery, activityQuery } from './queries.ts';
import type {
  MediaListEntry,
  ActivityEntry,
  GdprListEntry,
  GdprActivityEntry,
  ExportOutput,
} from './types.ts';
import {
  unixSecondsToTimestamp,
  fuzzyDateToNumber,
  mediaTypeToSeriesType,
  mediaListStatusToNumber,
  extractTrueKeys,
  actionTypeFromActivityStatus,
  buildAdvancedScoreNames,
  mapAdvancedScores,
  deduplicateById,
} from './utils.ts';

const argv = yargs(hideBin(process.argv));
const client = new GraphQLClient('https://graphql.anilist.co');
const delay = 60000 / 30;

async function fetchAllPaginatedEntries<T>(
  query: string,
  userId: number,
  extractEntries: (data: unknown) => T[],
  token?: string,
  startingPage?: number
): Promise<T[]> {
  const perPage = 50;
  let allEntries: T[] = [];
  let page = startingPage ?? 1;

  while (true) {
    try {
      const data = await client.request({
        document: query,
        variables: { page, perPage, userId },
        requestHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const entries = extractEntries(data);
      allEntries.push(...entries);

      if (entries.length < perPage) break;
      page++;
    } catch (error: any) {
      const response = error?.response;
      if (response?.status === 429) {
        const retryAfter = parseInt(response.headers?.['Retry-After'] ?? '1', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return allEntries;
}

async function fetchAllMediaListEntries(userId: number, token?: string, startingPage?: number): Promise<MediaListEntry[]> {
  return fetchAllPaginatedEntries(
    mediaListQuery,
    userId,
    (data: unknown) => (data as { Page: { mediaList: MediaListEntry[] } }).Page.mediaList,
    token,
    startingPage
  );
}

async function fetchAllActivityEntries(userId: number, token?: string, startingPage?: number): Promise<ActivityEntry[]> {
  return fetchAllPaginatedEntries(
    activityQuery,
    userId,
    (data: unknown) => (data as { Page: { activities: ActivityEntry[] } }).Page.activities,
    token,
    startingPage
  );
}

function printUsageAndExit(): void {
  console.error('Usage: node index.js --username <AniList username> [--token <API token>] [--update-data] [--output <output file>] [-o <output file>]');
  process.exit(1);
}

async function main(): Promise<void> {
  const parsed = await argv.parseAsync();
  const username = parsed.username as string;
  let token = parsed.token as string | undefined;
  let outputPath: string = (parsed.output ?? parsed.o ?? 'data-export.json') as string;

  if (!username) {
    printUsageAndExit();
  }

  let activtiyStartingPage: number | undefined = undefined;
  let listStartingPage: number | undefined = undefined;
  let existingLists: GdprListEntry[] = [];
  let existingActivity: GdprActivityEntry[] = [];
  let existingUser: ExportOutput["user"] | undefined = undefined;
  if (parsed['update-data']) {
    const existingPath = path.join(process.cwd(), 'data-export.json');
    try {
      const existingDataRaw = await readFile(existingPath, 'utf8');
      const existingData = JSON.parse(existingDataRaw) as ExportOutput;
      existingLists = existingData.lists || [];
      existingActivity = existingData.activity || [];
      existingUser = existingData.user;
      listStartingPage = Math.floor(existingLists.length / 50);
      activtiyStartingPage = Math.floor(existingActivity.length / 50);
      console.log(`Resuming from media list page ${listStartingPage} and activity page ${activtiyStartingPage}`);
    } catch (error) {
      console.warn('Could not read existing data-export.json, starting from scratch');
      console.warn(error);
    }
  }

  const userData = await client.request(userQuery, { name: username }, token ? { Authorization: `Bearer ${token}` } : {});
  const userId = userData.User.id as number;
  const mediaList = await fetchAllMediaListEntries(userId, token, listStartingPage);
  const activityList = await fetchAllActivityEntries(userId, token, activtiyStartingPage);

  console.log(`Fetched ${mediaList.length} media list entries and ${activityList.length} activity entries`);

  const advancedScoreNames = buildAdvancedScoreNames(mediaList);
  const animeCustomLists = new Set<string>();
  const mangaCustomLists = new Set<string>();

  const lists: GdprListEntry[] = mediaList.map((entry) => {
    const seriesType = mediaTypeToSeriesType(entry.media?.type ?? null);
    const customLists = extractTrueKeys(entry.customLists);

    for (const listName of customLists) {
      if (seriesType === 1) {
        mangaCustomLists.add(listName);
      } else {
        animeCustomLists.add(listName);
      }
    }

    return {
      id: entry.id,
      series_type: seriesType,
      user_id: entry.userId,
      series_id: entry.mediaId,
      status: mediaListStatusToNumber(entry.status),
      score: entry.score,
      progress: entry.progress,
      progress_volume: entry.progressVolumes,
      priority: 0,
      repeat: entry.repeat,
      private: entry.private ? 1 : 0,
      notes: entry.notes,
      custom_lists: customLists,
      advanced_scores: mapAdvancedScores(entry, advancedScoreNames),
      hidden_default: 0,
      started_on: fuzzyDateToNumber(entry.startedAt),
      finished_on: fuzzyDateToNumber(entry.completedAt),
      created_at: unixSecondsToTimestamp(entry.createdAt),
      updated_at: unixSecondsToTimestamp(entry.updatedAt),
    };
  });

  const activity: GdprActivityEntry[] = activityList.map((entry) => {
    const objectType = mediaTypeToSeriesType(entry.media?.type ?? null) + 1;
    const createdAt = unixSecondsToTimestamp(entry.createdAt);

    return {
      id: entry.id,
      user_id: entry.userId,
      messenger_id: null,
      action_type: actionTypeFromActivityStatus(entry.status),
      object_id: entry.media?.id ?? 0,
      object_type: objectType,
      object_value: entry.progress ?? '',
      reply_count: entry.replyCount,
      created_at: createdAt,
      updated_at: createdAt,
      locked: entry.isLocked ? 1 : 0,
      like_count: entry.likeCount,
      private: 0,
    };
  });

  if (activityList.length !== activity.length) {
    throw new Error('Activity list length mismatch after transformation');
  }

  const sortedAnimeList = Array.from(animeCustomLists).sort((a, b) => a.localeCompare(b));
  const sortedMangaList = Array.from(mangaCustomLists).sort((a, b) => a.localeCompare(b));

  const combinedLists = deduplicateById([...existingLists, ...lists]);
  const combinedActivity = deduplicateById([...existingActivity, ...activity]);

  const output: ExportOutput = {
    user: {
      user_name: username,
      about: userData.User.about,
      avatar_url: userData.User.avatar?.large?.split('/',).pop() ?? null,
      banner_url: userData.User.bannerImage ?? null,
      custom_lists: {
        anime: sortedAnimeList,
        manga: sortedMangaList,
      },
      advanced_scores: {
        active: advancedScoreNames.length > 0,
        names: advancedScoreNames,
      },
      ...(existingUser ? existingUser : {}),
    },
    lists: combinedLists,
    activity: combinedActivity,
  };


  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Exported data to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
