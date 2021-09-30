import { Octokit } from '@octokit/rest'
;(async () => {
    const octokit = new Octokit()
    const repo = {
        owner: 'zardoy',
        repo: 'modify-json-file',
    }

    // const nextVersion = getNextVersion(octokit, repo)
})().catch(err => {
    console.error(err)
    process.exit(1)
})
