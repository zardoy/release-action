import { Octokit } from '@octokit/rest'
import got from 'got/dist/source'
import { inc as bumpVersion, major, ReleaseType, gt } from 'semver'
import { Except } from 'type-fest'
import { readPackageJsonFile } from 'typed-jsonfile'
import { Config } from './config'
import { OctokitRepo } from './types'
import { readRootPackageJson } from './util'

export type SemverVersionString = `${number}.${number}.${number}` | `${number}.${number}.${number}-${string}`

export type BasicReleaseType = 'patch' | 'minor' | 'major'

type OptionalPropertyOf<T extends Record<string, unknown>> = Exclude<
    {
        [K in keyof T]: T extends Record<K, T[K]> ? never : K
    }[keyof T],
    undefined
>

// const notesRulesDefaults: Required<Pick<NotesRule, OptionalPropertyOf<NotesRule>>> = {
//     stripScope: false,
//     noteLink: true,
// }

interface VersionRule {
    matches: RegExp | { conventionalType: string }
    startsNew: boolean
    bump: false | ReleaseType
    stripByRegex?: boolean
    /** otherwise `bump` is used by default */
    notesSection?: string
}

const versionRules: VersionRule[] = [
    // TODO skip release
    {
        matches: { conventionalType: 'fix' },
        startsNew: true,
        bump: 'patch',
    },
    {
        matches: { conventionalType: 'feat' },
        startsNew: true,
        bump: 'minor',
    },
    {
        matches: /BREAKING( CHANGE)?:?/,
        startsNew: false,
        bump: 'major',
    },
]

const versionPriority: Record<BasicReleaseType | 'none', number> = {
    none: 0,
    patch: 1,
    minor: 2,
    major: 3,
}
const getBumpTypeByPriority = (priority: number) => Object.entries(versionPriority).find(([, p]) => p === priority)![0]

type VersionMap = Record<BasicReleaseType, BasicReleaseType> & {
    /** @default Always applicable */
    isApplicable?: (version: string) => boolean
}
export const makeVersionMaps = <T extends string>(versionsMaps: Record<T, VersionMap>) => versionsMaps

/** Opinionated too */
export const versionBumpingStrategies = makeVersionMaps({
    /**
     * 0.0.1 -> BREAKING -> 0.1.0 (not semver!)
     * 0.1.0 -> BREAKING -> 0.2.0
     * Used only when major version is 0
     */
    semverUnstable: {
        isApplicable: version => major(version) === 0,
        major: 'minor',
        minor: 'patch',
        patch: 'patch',
    },
    /**
     * Old prisma versioning (always max is minor)
     * 0.1.0 -> BREAKING -> 0.2.0
     * 2.0.1 -> BREAKING -> 2.1.0
     */
    unstable: {
        major: 'minor',
        minor: 'patch',
        patch: 'patch',
    },
    /** 0.0.1 -> maybe BREAKING CHANGE (we don't care) -> 0.0.2 */
    tooUnstable: {
        major: 'patch',
        minor: 'patch',
        patch: 'patch',
    },
})

type BumpVersionParams = {
    octokit: Octokit
    repo: OctokitRepo
    config: Config
}

type GetNextVersionParams = BumpVersionParams & {
    tagPrefix?: string
    /** When in prerelease */
    fallbackPrefix?: string
    autoUpdate?: boolean
}

export interface NextVersionReturn {
    bumpType: BasicReleaseType | 'none'
    /** undefined - version is the same */
    nextVersion: string | undefined
    commitsByRule:
        | {
              //   [noteRule: string]: { message: string; scope?: string }[]
              [noteRule: string]: string[]
          }
        | { rawOverride: string }
    /** No tags found, and package version doesn't start with 0.0.0 */
    usingInExistingEnv?: boolean
    latestTagCommitSha?: string
}
const logCi = (...msg: any) => process.env.CI && console.log(...msg)

/** DEFAULT. wrapper to use latest tag is present */
export const getNextVersionAndReleaseNotes = async ({
    octokit,
    repo,
    config,
    autoUpdate = false,
    tagPrefix = 'v',
    fallbackPrefix,
}: GetNextVersionParams): Promise<NextVersionReturn> => {
    const { data: tags } = await octokit.repos.listTags({
        ...repo,
        per_page: 1,
    })
    let latestTag: { name: string; commit: { sha } } | undefined
    for (const _tag of tags) {
        const { name: tagName } = _tag
        const satisfiesPrefix = (prefix: string) => tagName.startsWith(prefix) && !Number.isNaN(+tagName[prefix.length]!)
        // when in prerelease, try to pick latests regular version and only then prelease
        if (fallbackPrefix && satisfiesPrefix(fallbackPrefix)) {
            latestTag = _tag
            break
        }

        if (satisfiesPrefix(tagPrefix)) {
            latestTag = _tag
            break
        }
    }

    if (!latestTag) {
        const { version: currentVersion } = await readRootPackageJson()

        if (!currentVersion!.startsWith('0.0.0'))
            return {
                bumpType: 'none',
                nextVersion: currentVersion,
                commitsByRule: { rawOverride: config.initialVersion.releaseNotesWithExisting },
                usingInExistingEnv: true,
            }

        return {
            bumpType: 'none',
            nextVersion: config.initialVersion.version,
            commitsByRule: { rawOverride: config.initialVersion.releaseNotes },
        }
    }

    const data: NextVersionReturn = autoUpdate
        ? {
              bumpType: 'patch',
              nextVersion: bumpVersion(latestTag.name.slice(1), 'patch')!,
              commitsByRule: {},
          }
        : await getNextVersionAndReleaseNotesFromTag({
              tag: {
                  version: latestTag.name.slice(tagPrefix.length),
                  commitSha: latestTag.commit.sha,
              },
              octokit,
              repo,
              config,
          })
    return { ...data, latestTagCommitSha: latestTag.commit.sha }
}

/** use with fetched tag */
// eslint-disable-next-line complexity
export const getNextVersionAndReleaseNotesFromTag = async ({
    tag: { commitSha: tagCommitSha, version: tagVersion },
    octokit,
    repo,
    config,
}: // addCommitLink = true,
{ tag: Record<'version' | 'commitSha', string> /* addCommitLink?: boolean */ } & BumpVersionParams): Promise<NextVersionReturn> => {
    logCi('Found latest tag', tagVersion, 'on commit', tagCommitSha)
    let commits: Array<{ sha?: string; commit: { message: string } }> = []
    // #region Fetch commits before tag (exlusive)
    let commitsBeforeTag: Array<{ message: string; sha?: string }>
    // eslint-disable-next-line no-constant-condition
    for (let i = 1; true; i++) {
        const { data: justFetchedCommits } = await octokit.repos.listCommits({
            ...repo,
            sha: process.env.GITHUB_REF?.replace(/^refs\/heads\//, '') || undefined,
            // i don't think it matters: 30 or 100
            per_page: 100,
            page: i,
        })
        commits = [...commits, ...justFetchedCommits]
        const tagCommitIndex = justFetchedCommits.findIndex(c => c.sha === tagCommitSha)
        if (tagCommitIndex === -1) continue
        commitsBeforeTag = commits.slice(0, commits.length - justFetchedCommits.length + tagCommitIndex).map(c => ({ message: c.commit.message, sha: c.sha }))
        break
    }

    /** But before strategy resolve */
    let resolvedBumpLevel = 0
    const releaseNotes: NextVersionReturn['commitsByRule'] = {}
    const processCommitMessage = (message: string, isForMarkdownFile: boolean, sha?: string) => {
        let prNumber: string | undefined
        const closesIssues = [] as number[]
        message = message
            // too weak detection
            .replace(/\(#(\d+)\)$/, (_, num) => {
                prNumber = num
                return ''
            })
            .replace(/(?:closes|fixes|resolves) #(\d+)/g, (_, num) => {
                closesIssues.push(+num)
                return ''
            })
            // strip two empty lines into one
            .replace(/\n{3}/g, '\n\n')
            // strip whitespaces on every line
            .split('\n')
            .map(str => str.trim())
            .join('\n')
        if (prNumber) message += ` (#${prNumber})`
        else if (closesIssues.length > 0) message += ` (${closesIssues.map(n => `#${n}`).join(', ')})`

        if (sha && !prNumber && closesIssues.length === 0)
            message += isForMarkdownFile ? ` [\`${sha.slice(0, 7)}\`](https://github.com/${repo.owner}/${repo.repo}/commit/${sha})` : ` ${sha}`

        return message.trim()
    }
    // #endregion

    /** 1st group - type, 2nd - scope */
    const conventionalRegex = /^(?:\[.+]\s)??(\w+)(\(\S+\))?:/
    // TODO config.linksToSameCommit

    commit: for (const { message: commitMessage, sha: commitSha } of commitsBeforeTag) {
        const bumps: Array<{ bumpLevel: number; notesRule: string; rawMessage: string; scope?: string }> = []
        /** if true, add message to last `bumps` */
        let lastSatisfies = false
        for (const commitMessageLine of commitMessage.split('\n')) {
            if (!commitMessageLine.trim()) continue
            const isConventionalCommitMessage = conventionalRegex.test(commitMessageLine)
            conventionalRegex.lastIndex = 0
            let currentBump = {
                bumpLevel: 0,
                notesRule: undefined as undefined | string,
                versionRule: undefined! as VersionRule,
            }
            for (const versionRule of versionRules) {
                if ('conventionalType' in versionRule.matches) {
                    const [, type] = conventionalRegex.exec(commitMessageLine) || []
                    conventionalRegex.lastIndex = 0
                    if (type !== versionRule.matches.conventionalType) continue
                    // eslint-disable-next-line unicorn/prefer-regexp-test, @typescript-eslint/prefer-regexp-exec
                } else if (!commitMessageLine.match(versionRule.matches)) {
                    continue
                }

                // TODO cancel bumping of commitMessageLine, not whole commit
                if (versionRule.bump === false) continue commit
                const notesRule = versionRule.notesSection ?? versionRule.bump
                const currentPriority = versionPriority[versionRule.bump]
                if (currentPriority < currentBump.bumpLevel) continue
                currentBump = {
                    bumpLevel: currentPriority,
                    notesRule,
                    versionRule,
                }
            }

            if (!currentBump.notesRule) {
                if (isConventionalCommitMessage) lastSatisfies = false
                // TODO continue to use .at when node versions are resolved
                else if (lastSatisfies) bumps.slice(-1)[0]!.rawMessage += `\n${commitMessageLine}`

                continue
            }

            const { bumpLevel, notesRule, versionRule } = currentBump
            lastSatisfies = true
            // TODO config.linksToSameCommit
            // TODO move it to top
            const scope = conventionalRegex.exec(commitMessageLine)?.[2]
            conventionalRegex.lastIndex = 0
            let rawMessage = commitMessageLine
            if (versionRule.stripByRegex ?? true)
                rawMessage = rawMessage.replace(versionRule.matches instanceof RegExp ? versionRule.matches : conventionalRegex, '')

            if (versionRule.startsNew || bumps.length === 0) {
                bumps.push({
                    bumpLevel,
                    notesRule,
                    rawMessage,
                    scope,
                })
            } else {
                const lastBump = bumps.slice(-1)[0]!
                bumps.splice(-1, 1, {
                    ...lastBump,
                    bumpLevel,
                    notesRule,
                    rawMessage: `${lastBump.rawMessage}\n${rawMessage}`,
                })
            }
        }

        for (const { bumpLevel, notesRule, rawMessage, scope } of bumps) {
            if (!releaseNotes[notesRule]) releaseNotes[notesRule] = []
            // releaseNotes[notesRule]!.push({ message: processCommitMessage(rawMessage), scope })
            const message = processCommitMessage(rawMessage, false, commitSha)
            // commit sha undefined mostly on testing
            releaseNotes[notesRule]!.push(scope ? `**${scope.slice(1, -1)}**: ${message}` : message)
            if (bumpLevel < resolvedBumpLevel) continue
            resolvedBumpLevel = bumpLevel
        }
    }

    // TODO respect order config with l
    let nextVersion: undefined | string
    let bumpType = getBumpTypeByPriority(resolvedBumpLevel)
    // eslint-disable-next-line no-empty
    if (bumpType === 'none' || config.bumpingVersionStrategy === 'none') {
    } else {
        const strategyConfig = versionBumpingStrategies[config.bumpingVersionStrategy]
        // eslint-disable-next-line no-empty
        if (strategyConfig.isApplicable && !strategyConfig.isApplicable(tagVersion)) {
        } else {
            bumpType = strategyConfig[bumpType]
        }
    }

    if (bumpType !== 'none') {
        nextVersion = bumpVersion(tagVersion, bumpType)!
        if (nextVersion === null) throw new Error('Just bumped version is invalid')
    }

    return {
        bumpType,
        nextVersion,
        commitsByRule: releaseNotes,
    }
}
