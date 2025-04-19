/**
 * This file is used to mock the `@actions/github` module in tests.
 */
import { jest } from '@jest/globals'

export const context = {
  repo: jest.fn(() => ({
    owner: 'owner',
    repo: 'repo',
  })),
  runId: 123,
  runAttempt: 1,
}

export const getOctokit = jest.fn(() => ({
  rest: {
    actions: {
      getWorkflowRunAttempt: jest
        .fn()
        .mockResolvedValue({ 
          created_at: "2025-04-20T00:00:00Z",
          updated_at: "2025-04-20T00:01:00Z"
        }),
    },
  },
}));
