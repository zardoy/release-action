import { Octokit } from '@octokit/rest'
import { existsSync } from 'fs'
import { getGithubRemoteInfo } from 'github-remote-info'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { join } from 'path'
import { PackageJson } from 'type-fest'

/** Root of project, that contains .git and package.json to publish */
export const preparePackageJson = (dirPath: string) => {
    // TODO 1. url 2. find-up .git
    const info = await getGithubRemoteInfo(dirPath)
    if (!info) throw new Error('Init repository first!')
    modifyPackageJsonFile({ dir: dirPath }, packageJson => {
        const defaults: PackageJson = {
            types: 'build/index.d.ts',
            main: 'build/index.js',
            // TODO check paths
            files: ['build'],
            repository: `https://github.com/${info.owner}/${info.name}`,
            // TODO! investigate author
        }
        // TODO opinated! remove check
        // if (packageJson.bin && typeof packageJson.bin === 'string') {
        //     if (!existsSync(join(dirPath, packageJson.bin))) throw new Error('no bin!')
        // }
        return defaultsDeep(packageJson, defaults)
    })
}
