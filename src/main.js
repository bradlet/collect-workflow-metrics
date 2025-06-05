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
    const gitHead = core.getInput('git_head')
    const gitBase = core.getInput('git_base')

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

    // Calculate lead time if both git_head and git_base are provided
    if (gitHead && gitBase) {
      core.debug(
        `Calculating lead time between base: ${gitBase} and head: ${gitHead}`
      )

      const { data: compareData } = await octokit.rest.repos.compareCommits({
        owner: context.repo.owner,
        repo: context.repo.repo,
        base: gitBase,
        head: gitHead
      })

      if (compareData.commits && compareData.commits.length > 0) {
        // Calculate lead time for each commit
        const leadTimes = compareData.commits.map((commit) => {
          const commitTime = Date.parse(commit.commit.author.date)
          return actionStartTime - commitTime
        })

        // Calculate average lead time
        const averageLeadTime = Math.floor(
          leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length
        )

        core.debug(`Average lead time: ${averageLeadTime}ms`)

        // Calculate human readable format for lead time
        const leadTimeSecs = Math.floor(averageLeadTime / 1000)
        const leadTimeMinutes = Math.floor(leadTimeSecs / 60)
        const leadTimeSeconds = leadTimeSecs % 60
        const leadTimeHours = Math.floor(leadTimeMinutes / 60)
        const remainingMinutes = leadTimeMinutes % 60

        let leadTimeHuman
        if (leadTimeHours > 0) {
          leadTimeHuman = `${leadTimeHours}h ${remainingMinutes}m ${leadTimeSeconds}s`
        } else {
          leadTimeHuman = `${leadTimeMinutes}m ${leadTimeSeconds}s`
        }

        core.debug(`Lead time: ${leadTimeHuman}`)

        // Set lead time outputs
        core.setOutput('workflow_leadtime_ms', averageLeadTime)
        core.setOutput('workflow_leadtime_human', leadTimeHuman)
      } else {
        core.debug('No commits found between the specified refs')
        core.setOutput('workflow_leadtime_ms', '')
        core.setOutput('workflow_leadtime_human', '')
      }
    } else {
      core.debug('Lead time is skipped due to absent git ref inputs')
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
