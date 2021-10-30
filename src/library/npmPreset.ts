import execa from 'execa'
import { existsSync } from 'fs'
import { getGithubRemoteInfo } from 'github-remote-info'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { join } from 'path'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile } from 'typed-jsonfile'

export const main = async () => {
    const cwd = process.cwd()
    // PREPARE package.json
    const info = await getGithubRemoteInfo(cwd)
    if (!info) throw new Error('Init repository first!')
    await modifyPackageJsonFile({ dir: cwd }, packageJson => {
        const defaults: PackageJson = {
            types: 'build/index.d.ts',
            main: 'build/index.js',
            files: ['build'],
            repository: `https://github.com/${info.owner}/${info.name}`,
            // TODO investigate author
        }
        packageJson = defaultsDeep(packageJson, defaults)

        return packageJson
    })

    await execa('npm', ['run', 'build'], {
        extendEnv: false,
        env: {
            CI: process.env.CI,
        } as any,
    })
    validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    await execa('npm', ['publish', '--access', 'public'], {
        env: {
            NODE_AUTH_TOKEN: process.env.NPM_TOKEN,
        } as any,
    })
}

const validatePaths = (cwd: string, json) => {
    if (json.bin && typeof json.bin === 'string') {
        if (!existsSync(join(cwd, json.bin))) throw new Error('no bin!')
    }
    // TODO isn't it already checked by npm?
    for (const path of json.build) {
        if (!existsSync(join(cwd, path))) throw new Error('No build to publish')
    }
}
