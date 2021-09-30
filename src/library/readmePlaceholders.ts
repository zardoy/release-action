import { PackageJson, TsConfigJson } from 'type-fest'
import { RepoInfo } from 'github-remote-info'

type PlaceholderCallback = (data: { packageJson: PackageJson; tsconfigJson: TsConfigJson; originInfo: RepoInfo }) => string | Promise<string>

const makePlaceholders = <T extends Record<string, PlaceholderCallback>>(placeholders: T) => placeholders

export const placeholders = makePlaceholders({
    '[[paka-docs]]': ({ packageJson }) => {
        // TODO maybe text: Docs
        return `[API](https://paka.dev/npm/${packageJson})`
    },
})
