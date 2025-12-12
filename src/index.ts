#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { GraphQLClient } from 'graphql-request';
import { writeFile } from 'node:fs/promises';
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
} from './utils.ts';

const argv = yargs(hideBin(process.argv));
const client = new GraphQLClient('https://graphql.anilist.co');
const delay = 60000 / 30;

async function fetchAllPaginatedEntries<T>(
  query: string,
  userId: number,
  extractEntries: (data: unknown) => T[],
  token?: string
): Promise<T[]> {
  const perPage = 50;
  let allEntries: T[] = [];
  let page = 1;

  while (true) {
    const data = await client.request({
      document: query,
      variables: { page, perPage, userId },
      requestHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const entries = extractEntries(data);
    allEntries.push(...entries);

    if (entries.length < perPage) break;
    page++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return allEntries;
}

async function fetchAllMediaListEntries(userId: number, token?: string): Promise<MediaListEntry[]> {
  return fetchAllPaginatedEntries(
    mediaListQuery,
    userId,
    (data: unknown) => (data as { Page: { mediaList: MediaListEntry[] } }).Page.mediaList,
    token
  );
}

async function fetchAllActivityEntries(userId: number, token?: string): Promise<ActivityEntry[]> {
  return fetchAllPaginatedEntries(
    activityQuery,
    userId,
    (data: unknown) => (data as { Page: { activities: ActivityEntry[] } }).Page.activities,
    token
  );
}

function printUsageAndExit(): void {
  console.error('Usage: node index.js --username <AniList username> [--token <API token>]');
  process.exit(1);
}

async function main(): Promise<void> {
  const parsed = await argv.parseAsync();
  const username = parsed.username as string;
  let token = parsed.token as string | undefined;

  if (!username) {
    printUsageAndExit();
  }

  const userData = await client.request(userQuery, { name: username });
  const userId = userData.User.id as number;
  const mediaList = await fetchAllMediaListEntries(userId, token);
  const activityList = await fetchAllActivityEntries(userId, token);

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

  const output: ExportOutput = {
    user: {
      custom_lists: {
        anime: sortedAnimeList,
        manga: sortedMangaList,
      },
      advanced_scores: {
        active: advancedScoreNames.length > 0,
        names: advancedScoreNames,
      },
    },
    lists,
    activity,
  };

  const outputPath = path.join(process.cwd(), 'data-export.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${lists.length} lists and ${activity.length} activity items to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
