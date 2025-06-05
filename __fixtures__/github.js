/**
 * This file is used to mock the `@actions/github` module in tests.
 */
import { jest } from '@jest/globals'

export const context = {
  repo: {
    owner: 'owner',
    repo: 'repo'
  },
  runId: 123,
  runAttempt: 1
}

export const getOctokit = jest.fn(() => ({
  rest: {
    actions: {
      getWorkflowRunAttempt: jest.fn().mockResolvedValue({
        data: {
          created_at: '2025-04-20T00:00:00Z',
          updated_at: '2025-04-20T00:01:00Z'
        }
      })
    },
    repos: {
      compareCommits: jest.fn().mockResolvedValue({
        data: {
          commits: [
            {
              commit: {
                author: {
                  date: '2025-04-19T23:50:00Z' // 10 minutes before action start
                }
              }
            },
            {
              commit: {
                author: {
                  date: '2025-04-19T23:40:00Z' // 20 minutes before action start
                }
              }
            }
          ]
        }
      })
    }
  }
}))
