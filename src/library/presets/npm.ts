import { existsSync } from 'fs'
import { join } from 'path'
import execa from 'execa'
import { defaultsDeep } from 'lodash'
import { modifyPackageJsonFile } from 'modify-json-file'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile, readJsonFile } from 'typed-jsonfile'
import { InputData, runTestsIfAny, safeExeca } from './shared'

// going to add more advanced functionality to provide better experience for forks

export const main = async ({ repo, octokit }: InputData) => {
    // PREPARE package.json
    const buildDir = (await readJsonFile<any>('tsconfig.json')).compilerOptions.outDir
    if (!buildDir) throw new Error('No build dir is specified in tsconfig.json')
    await modifyPackageJsonFile({ dir: '.' }, packageJson => {
        const defaults: PackageJson = {
            files: ['build'],
            repository: repo.url,
            // TODO investigate author
        }
        if (buildDir && existsSync(join(buildDir, 'index.d.ts'))) {
            defaults.main = join(buildDir, 'index.js')
            defaults.types = join(buildDir, 'index.d.ts')
        }

        packageJson = defaultsDeep(packageJson, defaults)

        return packageJson
    })

    const packageJson = await readPackageJsonFile({ dir: '.' })
    if (packageJson.private) throw new Error("Packages that are going to publish to NPM can't be private")
    if (packageJson.scripts?.build) await safeExeca('pnpm', 'run build')
    else if (!packageJson.scripts?.prepublishOnly) throw new Error('Nothing to build, specify script first (prepublishOnly or build)')

    // not really great as it runs before prepublishOnly
    await runTestsIfAny()

    validatePaths(process.cwd(), await readPackageJsonFile({ dir: process.cwd() }))

    await execa('npm', ['publish', '--access', 'public'], {
        env: {
            NODE_AUTH_TOKEN: process.env.NPM_TOKEN,
        } as any,
    })

    // refactor to: detect and update
    const { homepage } = (await octokit.repos.get({ ...repo.octokit })).data
    if (homepage && !homepage.includes('npm')) throw new Error('Homepage must go to package on NPM')

    await octokit.repos.update({
        ...repo.octokit,
        homepage: `https://npmjs.com/${packageJson.name!}`,
    })
}

const validatePaths = (cwd: string, json: PackageJson) => {
    if (json.bin && typeof json.bin === 'string' && !existsSync(join(cwd, json.bin))) throw new Error('no bin!')

    // TODO isn't it already checked by npm?
    for (const path of json.files!) if (!existsSync(join(cwd, path))) throw new Error('No build to publish')
}
