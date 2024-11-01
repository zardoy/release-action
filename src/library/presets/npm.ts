import { existsSync } from 'fs'
import { join } from 'path'
import { endGroup, startGroup } from '@actions/core'
import execa from 'execa'
import got from 'got'
import { gt } from 'semver'
import { PackageJson, SetRequired } from 'type-fest'
import { readPackageJsonFile } from 'typed-jsonfile'
import globby from 'globby'
import del from 'del'
import { generateNpmPackageJsonFields } from '../presets-common/generatePackageJsonFields'
import { PresetMain } from '../presets-common/type'
import { readRootPackageJson } from '../util'
import { Config } from '../config'

// going to add more advanced functionality to provide better experience for forks

export const main: PresetMain<'npm'> = async ({ presetConfig, versionBumpInfo: { usingInExistingEnv } = {}, doPublish }) => {
    const initialPackageJson = await readRootPackageJson()
    if (initialPackageJson.private) throw new Error("Packages that are going to publish to NPM can't be private")

    const { packageJson, fieldsToRemove } = await generateNpmPackageJsonFields('.', presetConfig)

    if (!doPublish) return
    if (usingInExistingEnv) {
        // Tries to fetch latest version from npm. Thanks to fast jsdelivr
        const {
            body: { version: latestVersionOnNpm },
        } = await got<SetRequired<PackageJson, 'version'>>(`https://cdn.jsdelivr.net/npm/${packageJson.name!}/package.json`, { responseType: 'json' })
        if (!gt(packageJson.version!, latestVersionOnNpm)) throw new Error('When no tags found, version in package.json must be greater than that on NPM')
    }

    await validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    startGroup('publish')
    await execa('pnpm', ['publish', '--access', 'public', '--no-git-checks', '--ignore-scripts', '--tag', presetConfig.publishTag], { stdio: 'inherit' })
    endGroup()

    return {
        jsonFilesFieldsToRemove: {
            '.': fieldsToRemove,
        },
    }
}

export const beforeSharedActions = async (config: Config) => {
    // TODO! use custom tsc instead of this method
    if (config.cleanSource) await del(['src/**.{spec,test}.[jt]s'])
    const preset = config.preset as Parameters<PresetMain<'npm'>>[0]['presetConfig']
    if (preset.publishOnlyIfChanged) {
        const { name } = await readRootPackageJson()
        const downloadedLatest
    }
}

const validatePaths = async (cwd: string, json: PackageJson) => {
    if (json.bin && typeof json.bin === 'string' && !existsSync(join(cwd, json.bin))) throw new Error('no bin!')

    // TODO isn't it already checked by npm?
    if (!existsSync('.npmignore')) for (const pattern of json.files!) if ((await globby(pattern, {})).length === 0) throw new Error('No build to publish')
}
