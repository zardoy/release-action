import fs from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import { endGroup, startGroup } from '@actions/core'
import execa from 'execa'
import { trueCasePath } from 'true-case-path'
import { readPackageJsonFile } from 'typed-jsonfile'
import urlJoin from 'url-join'
import prettyBytes from 'pretty-bytes'
import fastFolderSizeCb from 'fast-folder-size'
import { Octokit } from '@octokit/rest'
import { runTestsIfAny, safeExeca } from '../presets-common/execute'
import { InputData, PresetMain } from '../presets-common/type'
import { markdownRemoveHeading } from '../readmeUtils'
import importFromRepo from '../presets-common/importFromRepo'
import { execAsStep, installGlobalWithPnpm } from '../utils'
import { OctokitRepoWithUrl } from '../types'
import { extractChangelogFromGithub, ReleasingChangelog } from '../changelogFromGithub'

const fastFolderSize = promisify(fastFolderSizeCb)

// always pnpm is used in this preset

/** shared main for vscode-extension* presets */
export const sharedMain = async ({ repo, presetConfig, changelog }: InputData<'vscode-extension'>) => {
    const initialPackageJson = await readPackageJsonFile({ dir: '.' })

    const hasFramework = initialPackageJson.dependencies?.['vscode-framework'] || initialPackageJson.devDependencies?.['vscode-framework']

    const hasCode = hasFramework && fs.existsSync('src/extension.ts')
    // await installGlobalWithPnpm(['vsce', 'ovsx'])
    await execAsStep('npm', 'i -g vsce ovsx')
    await execAsStep('vsce', '-V')
    if (hasCode && !fs.existsSync('src/generated.ts')) throw new Error('Missing generated types')
    const { runConfigurationGenerator } = await importFromRepo('vscode-framework/build/cli/configurationFromType').catch(() => ({}))
    if (fs.existsSync('src/configurationType.ts') && !fs.existsSync('src/configurationTypeCache.jsonc')) await runConfigurationGenerator('')

    if (!initialPackageJson.scripts?.build && hasCode) await execAsStep('pnpm', 'vscode-framework build')
    else if (initialPackageJson.scripts?.build) await execAsStep('pnpm', 'run build')
    if (presetConfig.runTest) await runTestsIfAny()

    const copyFiles = ['LICENSE']

    // eslint-disable-next-line @typescript-eslint/dot-notation
    if (initialPackageJson['web'] === true) {
        const toPatchFrameworkFile = 'out/extension-web.js'
        const extWebContents = await fs.promises.readFile(toPatchFrameworkFile, 'utf-8')
        const extWebLines = extWebContents.split('\n')
        await fs.promises.writeFile(toPatchFrameworkFile, [extWebLines[0], ...extWebLines.slice(73)].join('\n'), 'utf-8')
    }

    const targetDir = hasCode ? join(process.cwd(), 'out') : '.'
    await fs.promises.writeFile(
        join(targetDir, 'CHANGELOG.MD'),
        await generateChangelogContent({ ...repo, ...repo.octokit }, changelog!, hasCode ? targetDir : undefined),
        'utf-8',
    )
    if (hasCode) for (const fileName of copyFiles) await fs.promises.copyFile(fileName, join('out', fileName))

    const readmeFilePath = await trueCasePath('readme.md').catch(() => undefined)
    if (readmeFilePath) {
        const readme = await fs.promises.readFile(readmeFilePath, 'utf-8')
        const newReadme = await markdownRemoveHeading(readme, 'Extension Development Notes')
        await fs.promises.writeFile(hasCode ? 'out/README.MD' : readmeFilePath, newReadme)
    }

    const vsixPath = join(process.cwd(), 'output.vsix')
    await safeExeca('vsce', ['package', '--out', vsixPath], {
        cwd: targetDir,
    })
    const SIZE_LIMIT = 3 * 1024 * 1024 // 3 MB
    if ((await fs.promises.stat(vsixPath)).size > SIZE_LIMIT) throw new Error('Publishing .vsix size limit exceeded in 3 MB')
    return { vsixPath }
}

const generateChangelogContent = async (octokitWithRepo: OctokitRepoWithUrl, changelog: string, calculateSizeDirPath?: string): Promise<string> => {
    const packageJson = await readPackageJsonFile({ dir: '.' })
    const { totalCount, markdown } = await extractChangelogFromGithub(octokitWithRepo, { changelog, version: packageJson.version! })
    let metaInfo = `*releases*: ${totalCount}`
    if (calculateSizeDirPath) {
        const outDirSize = await fastFolderSize(calculateSizeDirPath)
        if (!outDirSize) throw new Error(`Failed to calculate size of out dir: ${outDirSize!}`)
        metaInfo += `, *current install size*: ${prettyBytes(outDirSize, { maximumFractionDigits: 1 })}`
    }

    metaInfo += ' \n\n# Changelog\n'
    return `${metaInfo}${markdown}`
}

export const main: PresetMain<'vscode-extension'> = async input => {
    const { vsixPath } = await sharedMain(input)

    if (!input.doPublish) return

    const { presetConfig } = input
    const possiblyPreReleaseOption = input.preRelease ? ['--pre-release'] : []
    // do this before first publishing to avoid problems with rerunning
    if (presetConfig.publishOvsx && !process.env.OVSX_PAT) throw new Error('Either pass OVSX_PAT secret or disable publishing to ovsx')
    if (presetConfig.publishMarketplace)
        await execAsStep('vsce', ['publish', '--packagePath', vsixPath, '--no-dependencies', ...possiblyPreReleaseOption], {
            stdio: 'inherit',
        })
    if (presetConfig.publishOvsx)
        try {
            await execAsStep('ovsx', ['publish', vsixPath, ...possiblyPreReleaseOption], {
                stdio: 'inherit',
            })
        } catch (error) {
            // don't care https://github.com/eclipse/openvsx/issues/539
            if (!error.message?.includes?.('server responded with status 503')) throw error
        }

    if (presetConfig.attachVsix) {
        const packageJson = await readPackageJsonFile({ dir: '.' })
        return {
            assets: [
                {
                    name: `${packageJson.name!}-${packageJson.version!}.vsix`,
                    path: vsixPath,
                },
            ],
        }
    }

    return undefined
}
