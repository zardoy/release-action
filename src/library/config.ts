import { SemverVersionString, versionMaps } from './bumpVersion'

namespace Plugin {
    /** What specific plugin hook can override */
    export type Override = {
        // newVersion?: SemverVersionString
        newVersion?: string
    }

    export interface PluginHooks<> {
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

export interface Config {
    initialVersion: {
        version: SemverVersionString
        releaseNotes: string
    }
    bumpingVersionStrategy: 'none' | keyof typeof versionMaps
    plugins: Record<string, Plugin.Plugin>
    /** Publish and generate changelog only when commit with [publish] in start is pushed (or custom regexp)
     * @default By default it would always publish
     */
    // TODO
    requirePublishKeyword: boolean | RegExp
}

export const defaultConfig: Config = {
    initialVersion: {
        version: '0.0.1',
        releaseNotes: '🎉 Initial release',
    },
    bumpingVersionStrategy: 'semverUnstable',
    plugins: builtinPlugins,
    requirePublishKeyword: false,
}
