import { gql } from 'graphql-request';

export const userQuery = gql`
  query User($name: String) {
    User(name: $name) {
      id
    }
  }
`;

export const mediaListQuery = gql`
  query MediaList($page: Int, $perPage: Int, $userId: Int) {
    Page(page: $page, perPage: $perPage) {
      mediaList(userId: $userId) {
        id
        mediaId
        createdAt
        customLists
        advancedScores
        notes
        private
        repeat
        progressVolumes
        progress
        updatedAt
        status
        score
        userId
        startedAt { year month day }
        completedAt { year month day }
        media { id type }
      }
    }
  }
`;

export const activityQuery = gql`
  query Page($page: Int, $perPage: Int, $userId: Int) {
    Page(page: $page, perPage: $perPage) {
      activities(userId: $userId) {
        ... on ListActivity {
          createdAt
          id
          likeCount
          progress
          userId
          type
          status
          isLocked
          replyCount
          media { id type }
        }
      }
    }
  }
`;
