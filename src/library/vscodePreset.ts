import fs from 'fs'
import execa from 'execa'
import { markdownRemoveHeading } from './readmeUtils'
import { join } from 'path'
// always pnpm is used in this preset

export const main = async () => {
    await execa('pnpm', ['vscode-framework', 'build'], {
        extendEnv: false,
        env: {
            CI: process.env.CI,
        } as any,
    })
    // use npm lib
    const copyFiles = ['LICENSE']
    for (const file of copyFiles) {
        await fs.promises.copyFile(file, join('out', file))
    }

    // specify target
    const readme = await fs.promises.readFile('./README.MD', 'utf-8')
    const newReadme = await markdownRemoveHeading(readme, 'Extension Development Notes')
    await fs.promises.writeFile('./out/README.MD', newReadme)
    // even if not on CI, updates to latest version
    await execa('pnpm', 'i -g vsce'.split(' '))
    const vsisPath = 'output.vsix'
    await execa('vsce', ['package', '--out', vsisPath])
    const SIZE_LIMIT = 3 * 1024 * 1024 // 3 MG
    if ((await fs.promises.stat(vsisPath)).size > SIZE_LIMIT) throw new Error('SIZE_LIMIT exceeded in 3 MG')
    await execa('vsce', ['publich', '--packagePath', vsisPath])
}
