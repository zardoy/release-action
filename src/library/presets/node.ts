import { readPackageJsonFile } from 'typed-jsonfile'
import { runBuild } from './shared'

export const main = async () => {
    const packageJson = await readPackageJsonFile({ dir: '.' })

    if (!packageJson.scripts?.build) throw new Error('Not NPM modules must have build script')
    if (packageJson.scripts.prepublishOnly) throw new Error("Not NPM can't have prepublishOnly script, use build instead")
    await runBuild()
    // it's supposed that workflow handle the rest
}
