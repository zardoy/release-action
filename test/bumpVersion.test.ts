/// <reference types="jest" />
import { Octokit } from '@octokit/rest'
import { getNextVersionAndReleaseNotes } from '../src/library/bumpVersion'
import { defaultConfig } from '../src/library/config'

const dummyRepo = { owner: '/', repo: '/' }

const getMockedOctokit = (tags: { name: `v${string}`; commit: { sha: string } }[], commitsInput: ({ message: string; sha?: string } | string)[]) => {
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

test('Initial release', async () => {
    expect(
        await getNextVersionAndReleaseNotes({
            config: defaultConfig,
            octokit: getMockedOctokit([], ['feat: something added']),
            repo: dummyRepo,
        }),
    ).toMatchInlineSnapshot()
})

test('Just bumps correctly', async () => {
    expect(
        await getNextVersionAndReleaseNotes({
            config: defaultConfig,
            octokit: getMockedOctokit(
                [{ name: 'v0.0.9', commit: { sha: '123' } }],
                [
                    'fix: fix serious issue\nfeat: add new feature',
                    'feat: just adding feature',
                    'fix: first fixes',
                    {
                        message: 'feat: should not be here',
                        sha: '123',
                    },
                ],
            ),
            repo: dummyRepo,
        }),
    ).toMatchInlineSnapshot()
})
