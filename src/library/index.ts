import { Octokit } from '@octokit/rest'
import { GlobalPreset } from './config'
;(async () => {
    if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not defined. Make sure you pass it via env from GitHub action')
    const preset = (process.argv[2] || 'npm') as GlobalPreset

    // const nextVersion = getNextVersion(octokit, repo)
})().catch(err => {
    console.error(err)
    process.exit(1)
})
