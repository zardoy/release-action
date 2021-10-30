import { Octokit } from '@octokit/rest'
import { defaultsDeep } from 'lodash'
import { defaultConfig, GlobalPreset, presetConfigOverrides } from './config'
import * as npmPreset from './npmPreset'
import * as vscodePreset from './vscodePreset'
;(async () => {
    if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not defined. Make sure you pass it via env from GitHub action')
    const preset = (process.argv[2] || 'npm') as GlobalPreset
    const config = defaultsDeep(presetConfigOverrides[preset], defaultConfig)
    if (preset === 'npm') {
        await npmPreset.main()
    }

    // const nextVersion = getNextVersion(octokit, repo)
})().catch(err => {
    console.error(err)
    process.exit(1)
})
