import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    const actionStartTime = Date.now()
    core.debug('Action start time: ' + actionStartTime)

    // This should be a token with access to your repository scoped in as a secret.
    // The YML workflow will need to set github_token with the GitHub Secret Token
    // github_token: ${{ secrets.GITHUB_TOKEN }}
    const token = core.getInput('github_token')

    const octokit = getOctokit(token)

    // read run_attempt from the ENV
    // It isn't available in the context object atm
    const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT) || 1

    core.debug(
      `request body: ${JSON.stringify({
        ...context.repo,
        run_id: context.runId,
        attempt_number: runAttempt
      })}`
    )

    const { data } = await octokit.rest.actions.getWorkflowRunAttempt({
      ...context.repo,
      run_id: context.runId,
      attempt_number: runAttempt
    })

    core.debug(`Created at: ${data.created_at}`)
    const createdAt = Date.parse(data.created_at)
    const diff = actionStartTime - createdAt
    core.debug('Diff: ' + diff)

    // Calculate human readable format
    const secs = Math.floor(diff / 1000)
    const minutes = Math.floor(secs / 60)
    const seconds = secs % 60
    core.debug(`Workflow runtime: ${minutes}m ${seconds}s`)

    // Set outputs for other workflow steps to use
    core.setOutput('workflow_runtime_ms', diff)
    core.setOutput('workflow_runtime_human', `${minutes}m ${seconds}s`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
