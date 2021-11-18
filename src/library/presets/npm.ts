import { existsSync } from 'fs'
import { join } from 'path'
import { endGroup, startGroup } from '@actions/core'
import execa from 'execa'
import got from 'got'
import { gt } from 'semver'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile } from 'typed-jsonfile'
import { generateNpmPackageJsonFields } from '../presets-common/generatePackageJsonFields'
import { PresetMain } from '../presets-common/type'
import { readRootPackageJson } from '../util'

// going to add more advanced functionality to provide better experience for forks

export const main: PresetMain<'npm'> = async ({ presetConfig, versionBumpInfo: { usingInExistingEnv } }) => {
    const initialPackageJson = await readRootPackageJson()
    if (initialPackageJson.private) throw new Error("Packages that are going to publish to NPM can't be private")

    const { packageJson, fieldsToRemove } = await generateNpmPackageJsonFields('.', presetConfig)

    if (usingInExistingEnv) {
        // Tries to fetch latest version from npm. Thanks to fast jsdelivr
        const {
            body: { version: latestVersionOnNpm },
        } = await got(`https://cdn.jsdelivr.net/npm/${packageJson.name!}/package.json`, { responseType: 'json' })
        if (!gt(packageJson.version!, latestVersionOnNpm)) throw new Error('When no tags found, version in package.json must be greater than that on NPM')
    }

    validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    startGroup('publish')
    await execa('pnpm', ['publish', '--access', 'public', '--no-git-checks', '--ignore-scripts', '--tag', presetConfig.publishTag], { stdio: 'inherit' })
    endGroup()

    return {
        jsonFilesFieldsToRemove: {
            '.': fieldsToRemove,
        },
    }
}

const validatePaths = (cwd: string, json: PackageJson) => {
    if (json.bin && typeof json.bin === 'string' && !existsSync(join(cwd, json.bin))) throw new Error('no bin!')

    // TODO isn't it already checked by npm?
    for (const path of json.files!) if (!existsSync(join(cwd, path))) throw new Error('No build to publish')
}
