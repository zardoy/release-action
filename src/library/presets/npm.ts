import { existsSync } from 'fs'
import { join } from 'path'
import execa from 'execa'
import { defaultsDeep } from 'lodash'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile, readJsonFile, writePackageJsonFile, readTsconfigJsonFile } from 'typed-jsonfile'
import { startGroup, endGroup } from '@actions/core'
import { InputData } from '../presets-common/type'

// going to add more advanced functionality to provide better experience for forks

export const main = async ({ repo, octokit }: InputData<'npm'>) => {
    const initialPackageJson = await readPackageJsonFile({ dir: '.' })
    const fieldsToRemove: string[] = []
    const generatedFields: Partial<PackageJson> = {
        files: ['build'],
        repository: repo.url,
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

    if (fieldsToRemove.length) {
        // TODO create pr with props removed
    }

    // PREPARE package.json
    const packageJson = defaultsDeep(initialPackageJson, generatedFields)
    await writePackageJsonFile({ dir: '.' }, packageJson)

    if (packageJson.private) throw new Error("Packages that are going to publish to NPM can't be private")

    validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    startGroup('publish')
    await execa('pnpm', ['publish', '--access', 'public', '--no-git-checks', '--ignore-scripts'], { stdio: 'inherit' })
    endGroup()
}

const validatePaths = (cwd: string, json: PackageJson) => {
    if (json.bin && typeof json.bin === 'string' && !existsSync(join(cwd, json.bin))) throw new Error('no bin!')

    // TODO isn't it already checked by npm?
    for (const path of json.files!) if (!existsSync(join(cwd, path))) throw new Error('No build to publish')
}
