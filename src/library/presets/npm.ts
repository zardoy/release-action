import { existsSync } from 'fs'
import { join } from 'path'
import { endGroup, startGroup } from '@actions/core'
import execa from 'execa'
import got from 'got'
import { defaultsDeep } from 'lodash'
import { gt } from 'semver'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile, readTsconfigJsonFile, writePackageJsonFile } from 'typed-jsonfile'
import { PresetMain } from '../presets-common/type'

// going to add more advanced functionality to provide better experience for forks

export const main: PresetMain<'npm'> = async ({ repo, octokit, versionBumpInfo: { usingInExistingEnv } }) => {
    const initialPackageJson = await readPackageJsonFile({ dir: '.' })
    const fieldsToRemove: string[] = []
    const generatedFields: Partial<PackageJson> = {
        files: ['build'],
    }

    // important defaul
    const buildDir = (await readTsconfigJsonFile({ dir: '.' })).compilerOptions?.outDir ?? 'build'
    if (existsSync(join(buildDir, 'index.d.ts'))) {
        generatedFields.main = join(buildDir, 'index.js')
        generatedFields.types = join(buildDir, 'index.d.ts')
    }

    const alwaysRemove = new Set(['repository'])
    for (const [fieldName, generatedValue] of Object.entries(generatedFields)) {
        if (!(fieldName in initialPackageJson)) continue
        if (generatedValue === initialPackageJson[fieldName] && !alwaysRemove.has(fieldName)) continue

        fieldsToRemove.push(fieldName)
    }

    // PREPARE package.json
    const packageJson = defaultsDeep(initialPackageJson, generatedFields) as PackageJson
    await writePackageJsonFile({ dir: '.' }, packageJson)

    if (packageJson.private) throw new Error("Packages that are going to publish to NPM can't be private")
    if (usingInExistingEnv) {
        // Tries to fetch latest version from npm. Thanks to fast jsdelivr
        const {
            body: { version: latestVersionOnNpm },
        } = await got(`https://cdn.jsdelivr.net/npm/${packageJson.name!}/package.json`, { responseType: 'json' })
        if (!gt(packageJson.version!, latestVersionOnNpm)) throw new Error('When no tags found, version in package.json must be greater than that on NPM')
    }

    validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    startGroup('publish')
    await execa('pnpm', ['publish', '--access', 'public', '--no-git-checks', '--ignore-scripts'], { stdio: 'inherit' })
    endGroup()

    return {
        packageJsonFieldsRemove: fieldsToRemove,
    }
}

const validatePaths = (cwd: string, json: PackageJson) => {
    if (json.bin && typeof json.bin === 'string' && !existsSync(join(cwd, json.bin))) throw new Error('no bin!')

    // TODO isn't it already checked by npm?
    for (const path of json.files!) if (!existsSync(join(cwd, path))) throw new Error('No build to publish')
}
