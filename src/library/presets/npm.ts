import { existsSync } from 'fs'
import { join } from 'path'
import execa from 'execa'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile } from 'typed-jsonfile'
import { runTests, safeExeca } from './shared'

export const main = async ({ repoUrl }: { repoUrl: string }) => {
    const cwd = process.cwd()
    // PREPARE package.json
    // const info = await getGithubRemoteInfo(cwd)
    // if (!info) throw new Error('Init repository first!')
    await modifyPackageJsonFile({ dir: cwd }, packageJson => {
        const defaults: PackageJson = {
            types: 'build/index.d.ts',
            main: 'build/index.js',
            files: ['build'],
            repository: repoUrl,
            // TODO investigate author
        }
        packageJson = defaultsDeep(packageJson, defaults)

        return packageJson
    })

    const packageJson = await readPackageJsonFile({ dir: '.' })
    if (packageJson.scripts?.build) await safeExeca('pnpm', 'run build')
    else if (!packageJson.scripts?.prepublishOnly) throw new Error('Nothing to build, specify script first (prepublishOnly or build)')

    // not really great as it runs before prepublishOnly
    await runTests()

    validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    await execa('npm', ['publish', '--access', 'public'], {
        env: {
            NODE_AUTH_TOKEN: process.env.NPM_TOKEN,
        } as any,
    })
}

const validatePaths = (cwd: string, json) => {
    if (json.bin && typeof json.bin === 'string' && !existsSync(join(cwd, json.bin))) throw new Error('no bin!')

    // TODO isn't it already checked by npm?
    for (const path of json.build) if (!existsSync(join(cwd, path))) throw new Error('No build to publish')
}
