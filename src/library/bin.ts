import { Octokit } from '@octokit/rest'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { getNextVersionAndReleaseNotes } from './bumpVersion'
import { generateChangelog } from './changelogGenerator'
import { defaultConfig, GlobalPreset, presetConfigOverrides } from './config'
import * as npmPreset from './npmPreset'
import * as vscodePreset from './vscodePreset'
import * as testingPreset from './testingPreset'
;(async () => {
    if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not defined. Make sure you pass it via env from GitHub action')
    const preset = (process.argv[2] || 'npm') as GlobalPreset
    // TODO cosmiconffig
    const config = defaultsDeep(presetConfigOverrides[preset], defaultConfig)
    const [owner, repoName] = process.env.GITHUB_REPOSITORY!.split('/')
    const repo = {
        owner: owner!,
        repo: repoName!,
    }
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    })
    const { commitsByRule, nextVersion } = await getNextVersionAndReleaseNotes({
        octokit,
        config: defaultConfig,
        repo,
    })
    if (!nextVersion) return
    const changelog = generateChangelog(commitsByRule, 'default')
    await modifyPackageJsonFile(
        { dir: '.' },
        {
            version: nextVersion,
        },
    )
    const presetToUse = (() => {
        switch (preset) {
            case 'npm':
                return npmPreset

            case 'vscode-extension':
                return vscodePreset

            // @ts-expect-error hidden presset
            case 'testings':
                return testingPreset

            default: {
                throw new Error('Incorrect preset')
            }
        }
    })()
    await presetToUse.main({ repoUrl: `https://github.com/${repo.owner}/${repo.repo}` })
    const tagVersion = `v${nextVersion}`
    await octokit.repos.createRelease({
        ...repo,
        tag_name: tagVersion,
        name: tagVersion,
        body: changelog,
    })

    // will setup assets publishing later, when I need ti
    // if (result && result.assets) {
    //     result.assets
    // }

    // const nextVersion = getNextVersion(octokit, repo)
})().catch(error => {
    console.error(error)
    process.exit(1)
})
