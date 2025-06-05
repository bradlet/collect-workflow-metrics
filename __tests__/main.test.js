/**
 * Unit tests for the action's main functionality, src/main.js
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.js', () => {
  const MOCKED_NOW = new Date('2025-04-20T00:01:00Z').getTime()
  let compareCommitsSpy

  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      return '' // Default empty string for other inputs
    })

    // Return the fixed "now" timestamp
    jest.spyOn(Date, 'now').mockReturnValue(MOCKED_NOW)

    // Create a persistent spy for compareCommits
    compareCommitsSpy = jest.fn().mockResolvedValue({
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

    // Reset the github mock to default state
    github.getOctokit.mockImplementation(() => ({
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
          compareCommits: compareCommitsSpy
        }
      }
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('Sets the workflow_runtime outputs', async () => {
    await run()

    // Verify the outputs were set.
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'workflow_runtime_ms',
      60_000
    )
    expect(core.setOutput).toHaveBeenNthCalledWith(
      2,
      'workflow_runtime_human',
      '1m 0s'
    )
  })

  it('Skips lead time calculation when git refs are not provided', async () => {
    await run()

    // Verify debug message about skipping lead time
    expect(core.debug).toHaveBeenCalledWith(
      'Lead time is skipped due to absent git ref inputs'
    )

    // Verify that only workflow runtime outputs are set (not lead time outputs)
    expect(core.setOutput).toHaveBeenCalledTimes(2)
    expect(core.setOutput).toHaveBeenCalledWith('workflow_runtime_ms', 60_000)
    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_runtime_human',
      '1m 0s'
    )
  })

  it('Skips lead time calculation when only git_head is provided', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      if (name === 'git_head') return 'feature-branch'
      return ''
    })

    await run()

    // Verify debug message about skipping lead time
    expect(core.debug).toHaveBeenCalledWith(
      'Lead time is skipped due to absent git ref inputs'
    )

    // Verify that only workflow runtime outputs are set
    expect(core.setOutput).toHaveBeenCalledTimes(2)
  })

  it('Skips lead time calculation when only git_base is provided', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      if (name === 'git_base') return 'main'
      return ''
    })

    await run()

    // Verify debug message about skipping lead time
    expect(core.debug).toHaveBeenCalledWith(
      'Lead time is skipped due to absent git ref inputs'
    )

    // Verify that only workflow runtime outputs are set
    expect(core.setOutput).toHaveBeenCalledTimes(2)
  })

  it('Calculates lead time when both git refs are provided', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      if (name === 'git_head') return 'feature-branch'
      if (name === 'git_base') return 'main'
      return ''
    })

    await run()

    // Verify that compareCommits was called with correct parameters
    expect(compareCommitsSpy).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      base: 'main',
      head: 'feature-branch'
    })

    // Expected lead time calculation based on the mock data:
    // Action start time: 2025-04-20T00:01:00Z = 1745107260000ms
    // Commit 1: 2025-04-19T23:50:00Z = 1745106600000ms, diff = 660,000ms (11 minutes)
    // Commit 2: 2025-04-19T23:40:00Z = 1745106000000ms, diff = 1,260,000ms (21 minutes)
    // Average: (660,000 + 1,260,000) / 2 = 960,000ms = 16 minutes
    const expectedLeadTimeMs = 960_000
    const expectedLeadTimeHuman = '16m 0s'

    // Verify all outputs were set
    expect(core.setOutput).toHaveBeenCalledTimes(4)
    expect(core.setOutput).toHaveBeenCalledWith('workflow_runtime_ms', 60_000)
    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_runtime_human',
      '1m 0s'
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_leadtime_ms',
      expectedLeadTimeMs
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_leadtime_human',
      expectedLeadTimeHuman
    )
  })

  it('Handles lead time calculation with hours', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      if (name === 'git_head') return 'feature-branch'
      if (name === 'git_base') return 'main'
      return ''
    })

    // Mock compareCommits to return commits with longer lead times
    github.getOctokit.mockImplementation(() => ({
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
                      date: '2025-04-19T22:01:00Z' // 2 hours before action start
                    }
                  }
                },
                {
                  commit: {
                    author: {
                      date: '2025-04-19T20:01:00Z' // 4 hours before action start
                    }
                  }
                }
              ]
            }
          })
        }
      }
    }))

    await run()

    // Expected lead time calculation:
    // Commit 1: 2 hours = 7,200,000ms
    // Commit 2: 4 hours = 14,400,000ms
    // Average: (7,200,000 + 14,400,000) / 2 = 10,800,000ms = 3 hours
    const expectedLeadTimeMs = 10_800_000
    const expectedLeadTimeHuman = '3h 0m 0s'

    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_leadtime_ms',
      expectedLeadTimeMs
    )
    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_leadtime_human',
      expectedLeadTimeHuman
    )
  })

  it('Handles case when no commits are found between refs', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      if (name === 'git_head') return 'feature-branch'
      if (name === 'git_base') return 'main'
      return ''
    })

    // Mock compareCommits to return no commits
    github.getOctokit.mockImplementation(() => ({
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
              commits: []
            }
          })
        }
      }
    }))

    await run()

    // Verify debug message about no commits
    expect(core.debug).toHaveBeenCalledWith(
      'No commits found between the specified refs'
    )

    // Verify that lead time outputs are set to 0
    expect(core.setOutput).toHaveBeenCalledWith('workflow_leadtime_ms', 0)
    expect(core.setOutput).toHaveBeenCalledWith(
      'workflow_leadtime_human',
      '0m 0s'
    )
  })

  it('Sets a failed status', async () => {
    github.getOctokit.mockImplementation(() => ({
      rest: {
        actions: {
          getWorkflowRunAttempt: jest
            .fn()
            .mockRejectedValueOnce(new Error('Failed to get repo'))
        }
      }
    }))

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenCalledWith('Failed to get repo')
  })

  it('Sets a failed status when compareCommits fails', async () => {
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'token'
      if (name === 'git_head') return 'feature-branch'
      if (name === 'git_base') return 'main'
      return ''
    })

    github.getOctokit.mockImplementation(() => ({
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
          compareCommits: jest
            .fn()
            .mockRejectedValueOnce(new Error('Failed to compare commits'))
        }
      }
    }))

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenCalledWith('Failed to compare commits')
  })
})
