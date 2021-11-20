import { Octokit } from '@octokit/rest'
import { Commit } from './bumpVersion.test'

export const getMockedOctokit = (tags: { name: `v${string}`; commit: { sha: string } }[], commitsInput: (Commit | string)[]) => {
    const commits: { sha: string; commit: { message: string } }[] = commitsInput.map(data => {
        if (typeof data === 'string') return { commit: { message: data }, sha: '' }
        const { message, sha = '' } = data
        return { commit: { message }, sha }
    })
    return {
        repos: {
            async listTags() {
                return { data: tags }
            },
            async listCommits() {
                return { data: commits }
            },
        },
    } as unknown as Octokit
}
