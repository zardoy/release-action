import { endGroup, startGroup } from '@actions/core'
import { Octokit, RestEndpointMethodTypes } from '@octokit/rest'
import { defaultsDeep } from 'lodash'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile, writePackageJsonFile } from 'typed-jsonfile'
import { GlobalPreset } from '../config'
import { readRootPackageJson } from '../util'
import { runTestsIfAny, safeExeca } from './execute'

/** Opinionated and will be changed in future */
type SharedActions = {
    /**
     * if `true` preset won't run if there is no version bump, only shared actions
     * if `false`, preset must handle:
     * - next version for publishing
     * - generating changelog
     * - making GitHub release
     *  */
    bumpVersionAndGenerateChangelog: boolean
    // runs before build :/
    // skips if not found
    runTest: boolean
    /**
     * - true - prepublishOnly or build
     * - enforce - enforce to have build script, throw if prepublishOnly is defined
     * - false - disable
     *   */
    runBuild: 'enforce' | boolean
    updateDescription: 'always' | 'ifEmpty' | false
    updateKeywords: 'always' | 'ifEmpty' | false
    updateHomepage: false | GetHomepageLink
    /** fields to generate in package.json */
    generateFields: Record<'repository', boolean>
}
type MaybePromise<T> = T | Promise<T>
type RepositoryMetadata = RestEndpointMethodTypes['repos']['get']['response']['data']
/** Can also throw e.g. if current homepage is set */
type GetHomepageLink = (metadata: RepositoryMetadata, packageJson: PackageJson) => MaybePromise<string | false>

const defaults: SharedActions = {
    bumpVersionAndGenerateChangelog: true,
    runTest: true,
    runBuild: false,
    updateDescription: 'ifEmpty',
    updateKeywords: false,
    updateHomepage: false,
    generateFields: {
        repository: true,
    },
}

const presetSpecificOverrides: Partial<Record<GlobalPreset, Partial<SharedActions>>> = {
    npm: {
        runBuild: true,
        updateHomepage({ homepage }, packageJson) {
            if (homepage && !homepage.includes('npm')) throw new Error('Homepage must go to package on NPM. Remove homepage and rerun action')
            return `https://npmjs.com/${packageJson.name!}`
        },
    },
    node: {
        runBuild: 'enforce',
    },
    'vscode-extension': {
        updateHomepage({ homepage }, packageJson) {
            if (homepage && !homepage.includes('marketplace.visualstudio')) throw new Error('Homepage must go to extension marketplace')
            return `https://marketplace.visualstudio.com/items?itemName=${(packageJson as any).publisher}.${packageJson.name!}`
        },
        generateFields: {
            // let vscode-framework handle it
            repository: false,
        },
    },
    'pnpm-monorepo': {
        bumpVersionAndGenerateChangelog: false,
        updateDescription: false,
        runBuild: 'enforce',
    },
}

export const resolveSharedActions = (preset: GlobalPreset) => defaultsDeep(presetSpecificOverrides[preset], defaults) as SharedActions

// eslint-disable-next-line complexity
export const runSharedActions = async (preset: GlobalPreset, octokit: Octokit, repo: { repo: string; owner: string }, actionsToRun: SharedActions) => {
    const packageJson = await readRootPackageJson()
    if (actionsToRun.runTest) await runTestsIfAny()

    if (actionsToRun.runBuild) {
        const { build: buildScript, prepublishOnly } = packageJson.scripts ?? {}
        if (actionsToRun.runBuild === 'enforce' && prepublishOnly) throw new Error(`Preset ${preset} can't have prepublishOnly script, use build instead`)

        if (prepublishOnly) {
            startGroup('pnpm run prepublishOnly')
            await safeExeca('pnpm', 'run prepublishOnly')
            endGroup()
        } else if (buildScript) {
            startGroup('pnpm run build')
            await safeExeca('pnpm', 'run build')
            endGroup()
        } else {
            throw new Error(
                actionsToRun.runBuild === 'enforce'
                    ? `Preset ${preset} must have build script`
                    : 'Nothing to build, specify script first (prepublishOnly or build)',
            )
        }
    }

    for (const [field, enablement] of Object.entries(actionsToRun.generateFields)) {
        if (!enablement) continue
        if (field === 'repository') packageJson[field] = `https://github.com/${repo.owner}/${repo.repo}`
    }

    await writePackageJsonFile({ dir: '.' }, packageJson)

    const repositoryMetadata = (await octokit.repos.get({ ...repo })).data
    const newMetadata: Partial<RestEndpointMethodTypes['repos']['update']['parameters']> = {}

    if (actionsToRun.updateDescription && packageJson.description)
        if (actionsToRun.updateDescription === 'ifEmpty') {
            if (!repositoryMetadata.description) newMetadata.description = packageJson.description
        } else {
            newMetadata.description = packageJson.description
        }

    if (actionsToRun.updateKeywords && packageJson.keywords)
        if (actionsToRun.updateKeywords === 'ifEmpty') {
            if (!repositoryMetadata.topics) newMetadata.topics = packageJson.keywords
        } else {
            newMetadata.topics = packageJson.keywords
        }

    if (actionsToRun.updateHomepage) {
        const newHomepage = await actionsToRun.updateHomepage(repositoryMetadata, packageJson)
        if (newHomepage) newMetadata.homepage = newHomepage
    }

    // TODO update metadata only after publishing
    if (Object.keys(newMetadata).length > 0)
        await octokit.repos.update({
            ...repo,
            ...newMetadata,
        })
}
