import { existsSync } from 'fs'
import path, { join } from 'path'
import { modifyPackageJsonFile } from 'modify-json-file'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile, readTsconfigJsonFile, writePackageJsonFile } from 'typed-jsonfile'
import { defaultsDeep } from 'lodash'
import { Config, PresetSpecificConfigs } from '../config'
import { OctokitRepo } from '../types'
import { SharedActions } from './sharedActions'

type NpmConfig = PresetSpecificConfigs['npm']

/**
 * @param dir **Relative** path to directory
 */
export const generateNpmPackageJsonFields = async (dir: string, npmConfig: NpmConfig, repoUrl?: string) => {
    const fieldsToRemove = new Set<keyof PackageJson>()
    const generatedFields: Partial<PackageJson> = {}
    const initialPackageJson = await readPackageJsonFile({ dir })
    generatedFields.files = ['build']
    if (npmConfig.minimumNodeVersion)
        generatedFields.engines = {
            node: npmConfig.minimumNodeVersion,
        }

    if (path.normalize(dir) !== '.' && repoUrl)
        generatedFields.repository = {
            type: 'git',
            url: repoUrl,
            directory: dir.replace(/\\/g, '/'),
        }

    // important default
    let buildDir: string
    try {
        buildDir = (await readTsconfigJsonFile({ dir })).compilerOptions?.outDir ?? 'build'
    } catch {
        buildDir = 'build'
    }

    if (existsSync(join(dir, 'src/bin.ts'))) generatedFields.bin = join(buildDir, 'bin.js')
    if (existsSync(join(dir, buildDir, 'index.d.ts'))) {
        generatedFields.main = join(buildDir, 'index.js')
        generatedFields.types = join(buildDir, 'index.d.ts')
    }

    const alwaysRemove = new Set(['repository'])
    for (const field of alwaysRemove) if (field in initialPackageJson) fieldsToRemove.add(field as any)

    for (const [fieldName, generatedValue] of Object.entries(generatedFields)) {
        if (!(fieldName in initialPackageJson)) continue
        if (generatedValue === initialPackageJson[fieldName]) continue

        fieldsToRemove.add(fieldName)
    }

    const packageJson = defaultsDeep(initialPackageJson, generatedFields) as PackageJson
    await writePackageJsonFile({ dir }, packageJson)

    return {
        packageJson,
        fieldsToRemove,
    }
}
