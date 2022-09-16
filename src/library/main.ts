/* eslint-disable max-depth */
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
import { resolveSharedActions, runSharedActions, SharedActions } from './presets-common/sharedActions'

export const program = new Command()

type Options = Partial<{
    vsixOnly: boolean
    forceUseVersion: boolean
    autoUpdate: boolean
}>

program
    .argument('<preset>', 'Preset to use')
    .option('--vsix-only', 'vscode-extension preset: attach vsix to release instead of publishing', false)
    .option('--force-use-version', 'Force use package.json version instead of resolving from commits history')
    .option('--auto-update', 'Force bump patch version and create tag instead of release')
    // eslint-disable-next-line complexity
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
            const actionsToRun = defaultsDeep(config.sharedActionsOverride, resolveSharedActions(preset)) as SharedActions
            if (options.forceUseVersion) actionsToRun.bumpVersionAndGenerateChangelog = false
            if (options.autoUpdate) config.githubPostaction = 'tag'
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
                      config,
                      repo,
                      autoUpdate: options.autoUpdate ?? false,
                  })
                : undefined
            if (versionBumpInfo?.usingInExistingEnv) console.log('No previous tool usage found. Enabling usingInExistingEnv mode')
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
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                presetToUse = require(`./presets/${preset}`) as PresetExports
            } catch (error) {
                throw new Error(`Incorrect preset ${preset}\n${error.message}`)
            }

            await presetToUse.beforeSharedActions?.(config)
            await runSharedActions(preset, octokit, repo, actionsToRun)
            if (versionBumpInfo && !versionBumpInfo.nextVersion) {
                console.warn('No next bumped version, skipping...')
                return
            }

            console.log('Going with version', (await readPackageJsonFile({ dir: '.' })).version)
            let presetConfig = config.preset
            if (options.vsixOnly)
                presetConfig = {
                    attachVsix: true,
                    publishMarketplace: false,
                    publishOvsx: false,
                } as PresetSpecificConfigs['vscode-extension']

            console.log('Running preset', preset)
            const result = await presetToUse.main({
                octokit,
                repo: {
                    octokit: repo,
                    url: `https://github.com/${repo.owner}/${repo.repo}`,
                },
                // TODO
                // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                newVersion: versionBumpInfo?.nextVersion!,
                presetConfig,
                versionBumpInfo,
                changelog,
            })

            if (versionBumpInfo) {
                const tagName = `v${versionBumpInfo.nextVersion!}`
                if (config.githubPostaction === 'release') {
                    const {
                        data: { id: release_id },
                    } = await octokit.repos.createRelease({
                        ...repo,
                        tag_name: tagName,
                        name: tagName,
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
                } else if (config.githubPostaction === 'tag' && versionBumpInfo.latestTagCommitSha) {
                    await octokit.git.createRef({
                        ...repo,
                        ref: `refs/tags/${tagName}`,
                        sha: versionBumpInfo.latestTagCommitSha,
                    })
                }
            }

            if (result?.postRun) result.postRun(octokit, await readPackageJsonFile({ dir: '.' }))

            // TODO remove json files
            // TODO! add fields from shared actions
        } catch (error_) {
            error(error_)
            process.exit(1)
        }
    })
