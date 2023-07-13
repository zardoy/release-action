import { SemverVersionString, versionBumpingStrategies } from './bumpVersion'
import { notesGenerators } from './changelogGenerator'
import { SharedActions } from './presets-common/sharedActions'

export const sharedConfig = {} as { skipScripts: boolean }

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Plugin {
    /** What specific plugin hook can override */
    export type Override = {
        // newVersion?: SemverVersionString
        newVersion?: string
    }

    export interface PluginHooks {
        onCommitMessage?: {
            matches: RegExp
            stripRegexp: boolean
            proceed: (params: { message: string; matches: RegExp }) => { newMessage?: string; override?: Override }
        }
    }

    export interface Plugin {
        hooks?: PluginHooks
    }
}

const makeBuiltintPlugins = <T extends string>(plugins: Record<T, Plugin.Plugin>) => plugins

export const builtinPlugins = makeBuiltintPlugins({
    /** Overrides */
    releaseStable: {
        hooks: {
            onCommitMessage: {
                matches: /^release stable/,
                stripRegexp: true,
                proceed() {
                    return {
                        override: {
                            newVersion: '1.0.0',
                        },
                    }
                },
            },
        },
    },
})

export type GlobalPreset = 'node' | 'npm' | 'pnpm-monorepo' | 'vscode-extension'

const makePresetConfigs = <T extends Record<GlobalPreset, Record<string, any>>>(t: T) => t

const npmSpecificConfig = {
    isPreRelease: false,
    publishTag: 'latest',
    // esm https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c#how-can-i-move-my-commonjs-project-to-esm
    minimumNodeVersion: '^12.20.0 || ^14.13.1 || >=16.0.0' as string | null,
}

export const presetSpecificConfigDefaults = makePresetConfigs({
    'vscode-extension': {
        publishOvsx: true,
        publishMarketplace: true,
        isPreRelease: false,
        attachVsix: false,
        runTest: true,
    },
    node: {},
    npm: {
        ...npmSpecificConfig,
    },
    'pnpm-monorepo': {
        mainPackage: undefined as string | undefined,
        ...npmSpecificConfig,
    },
})

export type PresetSpecificConfigs = typeof presetSpecificConfigDefaults

export interface Config {
    initialVersion: {
        version: SemverVersionString
        releaseNotes: string
        /** but when already was on NPM, but first tag */
        releaseNotesWithExisting: string
    }
    /** advanced. use with careful */
    sharedActionsOverride: Partial<SharedActions>
    bumpingVersionStrategy: 'none' | keyof typeof versionBumpingStrategies
    plugins: Record<string, Plugin.Plugin>
    cleanSource: boolean
    /** Publish and generate changelog only when commit with [publish] in start is pushed (or custom regexp)
     * @default false By default it would always publish
     */
    commitPublishPrefix: string | false
    // publishSkipKeyword
    linksToSameCommit: boolean
    /** Changelog generator config */
    changelog: {
        /** for now affects only headings style */
        style: keyof typeof notesGenerators
    }
    preset: Partial<PresetSpecificConfigs[keyof PresetSpecificConfigs]>
    githubPostaction: 'release' | 'tag' | false
    /** how to order notes by date of the commit. just reverses in case of `desc` */
    // notesOrder: 'asc-by-date' | 'desc-by-date'
    createReleaseTarget: 'currentCommit' | 'defaultBranch'
}

// TODO: ban any usage
export const defaultConfig: Config = {
    initialVersion: {
        version: '0.0.1',
        releaseNotes: '🎉 Initial release',
        releaseNotesWithExisting: '🎉 First publish with automatic release tool',
    },
    cleanSource: false,
    sharedActionsOverride: {},
    commitPublishPrefix: false,
    bumpingVersionStrategy: 'semverUnstable',
    plugins: builtinPlugins,
    changelog: {
        style: 'default',
    },
    // requirePublishKeyword: false,
    // notesOrder: 'asc-by-date',
    linksToSameCommit: true,
    githubPostaction: 'release',
    preset: {},
    createReleaseTarget: 'defaultBranch',
}
