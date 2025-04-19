import * as core from '@actions/core'
import { context, getOctokit } from "@actions/github";
/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    // This should be a token with access to your repository scoped in as a secret.
    // The YML workflow will need to set github_token with the GitHub Secret Token
    // github_token: ${{ secrets.GITHUB_TOKEN }}
    const token = core.getInput('github_token');
    core.debug(`Token: ${token}`);

    const octokit = getOctokit(token);

    core.debug(`request body: ${JSON.stringify({
      ...context.repo,
      run_id: context.runId,
      run_attempt: context.runAttempt,
    })}`);

    const { created_at, updated_at } = await octokit.rest.actions.getWorkflowRunAttempt({
      ...context.repo,
      run_id: context.runId,
      attempt_number: context.runAttempt,
    });

    core.debug(`Created at: ${created_at} | Updated at: ${updated_at}`);
    const createdAt = Date.parse(created_at);
    const updatedAt = Date.parse(updated_at);
    const diff = updatedAt - createdAt
    core.debug('Diff: ' + diff);

    // Calculate human readable format
    const secs = Math.floor(diff / 1000);
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    core.debug(`Workflow runtime: ${minutes}m ${seconds}s`);

    // Set outputs for other workflow steps to use
    core.setOutput('workflow_runtime_ms', diff)
    core.setOutput('workflow_runtime_human', `${minutes}m ${seconds}s`);
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
