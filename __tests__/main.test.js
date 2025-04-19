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

  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation(() => 'token')

    // Return the fixed "now" timestamp
    jest.spyOn(Date, 'now').mockReturnValue(MOCKED_NOW)
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
})
