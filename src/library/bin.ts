import { promises } from 'fs'
import { Octokit } from '@octokit/rest'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { cosmiconfig } from 'cosmiconfig'
import { getNextVersionAndReleaseNotes } from './bumpVersion'
import { generateChangelog } from './changelogGenerator'
import { defaultConfig, GlobalPreset } from './config'
import { OutputData, PresetExports } from './presets/shared'
// TODO use super commander here
;(async () => {
    if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not defined. Make sure you pass it via env from GitHub action')
    const preset = process.argv[2] as GlobalPreset
    if (!preset) throw new Error('Preset must be defined!')
    if (!process.env.CI) throw new Error('The tools is intended to be run in GitHub action workflow')
    const explorer = cosmiconfig('release')
    const userConfig = await explorer.search()
    const config = defaultsDeep(userConfig?.config || {}, defaultConfig)
    const [owner, repoName] = process.env.GITHUB_REPOSITORY!.split('/')
    const repo = {
        owner: owner!,
        repo: repoName!,
    }
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    })
    const { commitsByRule, nextVersion, bumpType } = await getNextVersionAndReleaseNotes({
        octokit,
        config: defaultConfig,
        repo,
    })
    if (!nextVersion) return
    const changelog = generateChangelog(commitsByRule, 'default', { bumpType })
    await modifyPackageJsonFile(
        { dir: '.' },
        {
            version: nextVersion,
        },
    )

    const notPreset = ['shared']
    if (notPreset.includes(preset)) throw new Error(`${preset} can't be used as preset`)
    let presetToUse: PresetExports
    try {
        presetToUse = require(`./presets/${preset}`) as PresetExports
    } catch (error) {
        throw new Error(`Incorrect preset ${preset}\n${error.message}`)
    }

    const result = await presetToUse.main({
        octokit,
        repo: {
            octokit: repo,
            url: `https://github.com/${repo.owner}/${repo.repo}`,
        },
        newVersion: nextVersion,
    })

    const tagVersion = `v${nextVersion}`
    const {
        data: { id: release_id },
    } = await octokit.repos.createRelease({
        ...repo,
        tag_name: tagVersion,
        name: tagVersion,
        body: changelog,
    })

    if (result?.assets)
        for (const { path, name } of result.assets)
            await octokit.repos.uploadReleaseAsset({
                ...repo,
                data: (await promises.readFile(path)) as any,
                name,
                release_id,
            })
})().catch(error => {
    console.error(error)
    process.exit(1)
})
