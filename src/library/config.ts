import { SemverVersionString, versionBumpingStrategies } from './bumpVersion'

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

export type GlobalPreset = 'node' | 'npm' | 'vscode-extension' | 'vscode-extension-vsix'

const makePresetConfigs = <T extends Record<GlobalPreset, Record<string, any>>>(t: T) => t

/** config that exclusive to some preset */
export const presetsConfigDefaults = makePresetConfigs({
    'vscode-extension': {
        publishOvsx: true,
        publishMarketplace: true,
        attachVsix: false,
    },
    'vscode-extension-vsix': {},
    node: {},
    npm: {},
})

export interface Config {
    initialVersion: {
        version: SemverVersionString
        releaseNotes: string
        /** but when already was on NPM, but first tag */
        releaseNotesWithExisting: string
    }
    bumpingVersionStrategy: 'none' | keyof typeof versionBumpingStrategies
    plugins: Record<string, Plugin.Plugin>
    /** Publish and generate changelog only when commit with [publish] in start is pushed (or custom regexp)
     * @default By default it would always publish
     */
    // TODO
    // requirePublishKeyword: boolean | RegExp
    // publishSkipKeyword
    linksToSameCommit: boolean
    /** Changelog generator config */
    changelog: {
        /** now affects only headings style */
        style: 'default' /*  | 'emoji' */
    }
    // preset: typeof presetsConfigDefaults
    /** how to order notes by date of the commit. just reverses in case of `desc` */
    // notesOrder: 'asc-by-date' | 'desc-by-date'
}

export const defaultConfig: Config = {
    initialVersion: {
        version: '0.0.1',
        releaseNotes: '🎉 Initial release',
        releaseNotesWithExisting: '🎉 First publish with automatic release tool',
    },
    bumpingVersionStrategy: 'semverUnstable',
    plugins: builtinPlugins,
    changelog: {
        style: 'default',
    },
    // requirePublishKeyword: false,
    // notesOrder: 'asc-by-date',
    linksToSameCommit: true,
    // preset: {},
}
