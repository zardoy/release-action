import fs from 'fs'
import { join, posix } from 'path'
import execa from 'execa'
import { readPackageJsonFile } from 'typed-jsonfile'
import { startGroup, endGroup } from '@actions/core'
import { markdownRemoveHeading } from '../readmeUtils'
import { InputData, runTestsIfAny, safeExeca } from './shared'
// always pnpm is used in this preset

/** shared main for vscode-extension* presets */
export const sharedMain = async ({ repo }: InputData) => {
    if (fs.existsSync('src/extension.ts')) {
        startGroup('vscode-framework build')
        await safeExeca('pnpm', 'vscode-framework build')
        endGroup()
        await runTestsIfAny()
    }

    // try to save extra size
    // const copyFiles = ['LICENSE']
    const copyFiles = []

    const CHANGELOG_CONTENT = `# Changelog\nChangelog will go here in future releases. For now you can view [changelog at GitHub](${posix.join(
        repo.url,
        'releases',
    )})`
    await fs.promises.writeFile('./out/CHANGELOG.MD', CHANGELOG_CONTENT, 'utf-8')
    for (const file of copyFiles) await fs.promises.copyFile(file, join('out', file))

    // specify target
    const readme = await fs.promises.readFile('./README.MD', 'utf-8')
    const newReadme = await markdownRemoveHeading(readme, 'Extension Development Notes')
    await fs.promises.writeFile('./out/README.MD', newReadme)
    // even if not on CI, updates to latest version
    startGroup('pnpm i -g vsce')
    await execa('pnpm', 'i -g vsce'.split(' '), { stdio: 'inherit' })
    endGroup()
    const vsixPath = 'output.vsix'
    await safeExeca('vsce', ['package', '--out', vsixPath])
    const SIZE_LIMIT = 3 * 1024 * 1024 // 3 MG
    if ((await fs.promises.stat(vsixPath)).size > SIZE_LIMIT) throw new Error('SIZE_LIMIT exceeded in 3 MG')
    return { vsixPath }
}

export const main = async (input: InputData) => {
    const { vsixPath } = await sharedMain(input)

    startGroup('publish')
    await execa('vsce', ['publish', '--packagePath', vsixPath], { stdio: 'inherit' })
    await execa('npx -y ovsx', ['publish', '--packagePath', vsixPath], { stdio: 'inherit' })
    endGroup()
    const { octokit, repo } = input
    const { homepage } = (await octokit.repos.get({ ...repo.octokit })).data
    if (homepage && !homepage.includes('marketplace.visualstudio')) throw new Error('Homepage must go to extension marketplace')

    const packageJson = await readPackageJsonFile({ dir: '.' })

    await octokit.repos.update({
        ...repo.octokit,
        homepage: `https://marketplace.visualstudio.com/items?itemName=${(packageJson as any).publisher}.${packageJson.name!}`,
    })
}
