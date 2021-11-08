import { promises } from 'fs'
import { Octokit } from '@octokit/rest'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { cosmiconfig } from 'cosmiconfig'
import { readPackageJsonFile } from 'typed-jsonfile'
import { error, startGroup, endGroup } from '@actions/core'
import { Command } from 'commander'
import { getNextVersionAndReleaseNotes } from './bumpVersion'
import { generateChangelog } from './changelogGenerator'
import { Config, defaultConfig, GlobalPreset, presetSpecificConfigDefaults, PresetSpecificConfigs } from './config'
import { PresetExports } from './presets-common/type'
import { resolveSharedActions, runSharedActions } from './presets-common/sharedActions'

const program = new Command()

type Options = {
    vsixOnly: boolean
}

program
    .argument('<preset>', 'Preset to use')
    .option('--vsix-only', 'vscode-extension preset: attach vsix to release instead of publishing', false)
    .action(async (preset: GlobalPreset, options: Options) => {
        try {
            if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not defined. Make sure you pass it via env from GitHub action')
            if (!process.env.CI) throw new Error('This tool is intended to be run in GitHub action workflow')
            const userConfig = await cosmiconfig('release').search()
            const config = defaultsDeep(userConfig?.config || {}, defaultConfig) as Config
            config.preset = defaultsDeep(config.preset, presetSpecificConfigDefaults[preset])
            startGroup('Resolved config')
            console.log('Using user config:', !!userConfig)
            console.log(config)
            endGroup()
            const actionsToRun = resolveSharedActions(preset)
            startGroup('Shared actions for preset')
            console.log(actionsToRun)
            endGroup()
            const [owner, repoName] = process.env.GITHUB_REPOSITORY!.split('/')
            const repo = {
                owner: owner!,
                repo: repoName!,
            }
            const octokit = new Octokit({
                auth: process.env.GITHUB_TOKEN,
            })

            const versionBumpInfo = actionsToRun.bumpVersionAndGenerateChangelog
                ? await getNextVersionAndReleaseNotes({
                      octokit,
                      config: defaultConfig,
                      repo,
                  })
                : undefined
            const changelog = versionBumpInfo
                ? generateChangelog(
                      versionBumpInfo.commitsByRule,
                      {
                          bumpType: versionBumpInfo.bumpType,
                          npmPackage: preset === 'npm' ? (await readPackageJsonFile({ dir: '.' })).name : undefined,
                      },
                      config,
                  )
                : undefined
            if (versionBumpInfo)
                await modifyPackageJsonFile(
                    { dir: '.' },
                    {
                        version: versionBumpInfo.nextVersion,
                    },
                )

            let presetToUse: PresetExports
            try {
                // eslint-disable-next-line zardoy-config/@typescript-eslint/no-require-imports
                presetToUse = require(`./presets/${preset}`) as PresetExports
            } catch (error) {
                throw new Error(`Incorrect preset ${preset}\n${error.message}`)
            }

            await runSharedActions(preset, octokit, repo, actionsToRun)
            if (versionBumpInfo && !versionBumpInfo.nextVersion) return

            let presetConfig = config.preset
            if (options.vsixOnly)
                presetConfig = {
                    attachVsix: true,
                    publishMarketplace: false,
                    publishOvsx: false,
                } as PresetSpecificConfigs['vscode-extension']

            const result = await presetToUse.main({
                octokit,
                repo: {
                    octokit: repo,
                    url: `https://github.com/${repo.owner}/${repo.repo}`,
                },
                newVersion: versionBumpInfo!.nextVersion!,
                presetConfig,
                versionBumpInfo: versionBumpInfo!,
            })

            if (versionBumpInfo) {
                const tagVersion = `v${versionBumpInfo.nextVersion!}`
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
            }

            if (result?.postRun) result.postRun(octokit, await readPackageJsonFile({ dir: '.' }))

            const packageJsonFieldsRemove = [...(result?.packageJsonFieldsRemove ?? []), 'repository']
            if (result?.packageJsonFieldsRemove) {
                // TODO create pr with props removed
            }
        } catch (error_) {
            error(error_)
            process.exit(1)
        }
    })

program.parse(process.argv)
