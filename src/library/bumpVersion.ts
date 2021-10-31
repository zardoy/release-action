import { Octokit } from '@octokit/rest'
import { inc as bumpVersion, major, ReleaseType } from 'semver'
import { Config } from './config'
import { OctokitRepo } from './types'

export type SemverVersionString = `${number}.${number}.${number}` | `${number}.${number}.${number}-${string}`

type BasicReleaseType = 'patch' | 'minor' | 'major'

export interface NotesRule {
    groupTitle: string
    stripScope?: boolean
    /** PR, otherwise commit linked issue, otherwise commit if commit is empty - nothing */
    noteLink?: boolean
}

type OptionalPropertyOf<T extends object> = Exclude<
    {
        [K in keyof T]: T extends Record<K, T[K]> ? never : K
    }[keyof T],
    undefined
>

const notesRulesDefaults: Required<Pick<NotesRule, OptionalPropertyOf<NotesRule>>> = {
    stripScope: false,
    noteLink: true,
}

interface VersionRule {
    matches: RegExp | { conventionalType: string }
    startsNew: boolean
    bump: false | ReleaseType
    stripByRegex?: boolean
    /** otherwise `bump` is used by default */
    notesRule?: string
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
    /** @default Always appliable */
    isAppliable?: (version: string) => boolean
}
export const makeVersionMaps = <T extends string>(versionsMaps: Record<T, VersionMap>) => versionsMaps

/** Opiniated too */
export const versionBumpingStrategies = makeVersionMaps({
    /**
     * 0.0.1 -> BREAKING -> 0.1.0 (not semver!)
     * 0.1.0 -> BREAKING -> 0.2.0
     * Used only when major version is 0
     */
    semverUnstable: {
        isAppliable: version => major(version) === 0,
        major: 'minor',
        minor: 'patch',
        patch: 'patch',
    },
    /**
     * Old prisma versioining (always max is minor)
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
}

/** DEFAULT. wrapper to use latest tag is present */
export const getNextVersionAndReleaseNotes = async ({ octokit, repo, config }: BumpVersionParams): Promise<NextVersionReturn> => {
    const { data: tags } = await octokit.repos.listTags({
        ...repo,
        per_page: 1,
    })
    const noTags = tags.length === 0
    if (noTags) {
        return {
            bumpType: 'none',
            nextVersion: config.initialVersion.version,
            commitsByRule: { rawOverride: config.initialVersion.releaseNotes },
        }
    } else {
        const latestTag = tags[0]!
        return await getNextVersionAndReleaseNotesFromTag({
            tag: {
                version: latestTag.name.slice(1),
                commitSha: latestTag.commit.sha,
            },
            octokit,
            repo,
            config,
        })
    }
}

/** use with fetched tag */
export const getNextVersionAndReleaseNotesFromTag = async ({
    tag: { commitSha: tagCommitSha, version: tagVersion },
    octokit,
    repo,
    config,
}: // addCommitLink = true,
{ tag: Record<'version' | 'commitSha', string> /* addCommitLink?: boolean */ } & BumpVersionParams): Promise<NextVersionReturn> => {
    let commits: { sha?: string; commit: { message: string } }[] = []
    for (let i = 1; true; i++) {
        const { data: justFetchedCommits } = await octokit.repos.listCommits({
            ...repo,
            // i don't think it matters: 30 or 100
            per_page: 100,
            page: i,
        })
        commits = [...commits, ...justFetchedCommits]
        const tagCommitIndex = justFetchedCommits.findIndex(c => c.sha === tagCommitSha)
        if (tagCommitIndex === -1) continue
        const commitsBeforeTag = commits.slice(0, commits.length - justFetchedCommits.length + tagCommitIndex)
        const commitMessagesBeforeTag = commitsBeforeTag.map(c => ({ message: c.commit.message, sha: c.sha }))
        /** But before strategy resolve */
        let resolvedBumpLevel = 0
        const releaseNotes: NextVersionReturn['commitsByRule'] = {}
        const processCommitMessage = (message: string, sha?: string) => {
            let prNumber: string | undefined
            let closesIssues = [] as number[]
            message = message
                // too weak detection
                .replace(/\(#(\d+)\)$/, (_, num) => {
                    prNumber = num
                    return ''
                })
                .replace(/(?:closes|fixes) #(\d+)/g, (_, num) => {
                    closesIssues.push(+num)
                    return ''
                })
                // strip two empty lines into one
                .replace(/\n\n\n/g, '\n\n')
                // strip whitespaces on every line
                .split('\n')
                .map(str => str.trim())
                .join('\n')
            if (prNumber) message += `(${prNumber})`
            else if (closesIssues.length) message += ` (${closesIssues.map(n => `#${n}`).join(', ')})`

            if (sha) message += `[\`${sha.slice(0, 7)}\`](https://github.com/${repo.owner}/${repo.repo}/commit/${sha})`

            return message.trim()
        }
        /** 1st group - type, 2nd - scope */
        const conventionalRegex = /^(?:\S+\s)?(\w+)(\(\S+\))?:/
        // TODO config.linksToSameCommit
        commit: for (const { message: commitMessage, sha: commitSha } of commitMessagesBeforeTag) {
            const bumps: Array<{ bumpLevel: number; notesRule: string; rawMessage: string; scope?: string }> = []
            let lineNumber = -1
            /** if true, add message to last `bumps` */
            let lastSatisfies = false
            for (const commitMessageLine of commitMessage.split('\n')) {
                lineNumber++
                let isConventionalCommitMessage = conventionalRegex.test(commitMessageLine)
                conventionalRegex.lastIndex = 0
                let currentBump = {
                    bumpLevel: 0,
                    notesRule: null as null | string,
                    versionRule: null! as VersionRule,
                }
                for (const versionRule of versionRules) {
                    if ('conventionalType' in versionRule.matches) {
                        const [, type] = conventionalRegex.exec(commitMessageLine) || []
                        conventionalRegex.lastIndex = 0
                        if (type !== versionRule.matches.conventionalType) continue
                    } else {
                        if (!commitMessageLine.match(versionRule.matches)) continue
                    }
                    // TODO cancel bumping of commitMessageLine, not whole commit
                    if (versionRule.bump === false) continue commit
                    const notesRule = versionRule.notesRule ?? versionRule.bump
                    const currentPriority = versionPriority[versionRule.bump]
                    if (currentPriority < currentBump.bumpLevel) continue
                    currentBump = {
                        bumpLevel: currentPriority,
                        notesRule,
                        versionRule,
                    }
                }
                if (!currentBump.notesRule) {
                    if (isConventionalCommitMessage) {
                        lastSatisfies = false
                    } else {
                        // TODO continue to use .at when node versions are resolved
                        if (lastSatisfies) bumps.slice(-1)[0]!.rawMessage += `\n${commitMessageLine}`
                    }
                    continue
                }
                const { bumpLevel, notesRule, versionRule } = currentBump
                lastSatisfies = true
                // TODO config.linksToSameCommit
                // TODO move it to top
                const scope = conventionalRegex.exec(commitMessage)?.[2]
                conventionalRegex.lastIndex = 0
                let rawMessage = commitMessageLine
                if (versionRule.stripByRegex ?? true) {
                    rawMessage = rawMessage.replace(versionRule.matches instanceof RegExp ? versionRule.matches : conventionalRegex, '')
                }
                if (versionRule.startsNew || bumps.length === 0) {
                    bumps.push({
                        bumpLevel,
                        notesRule,
                        rawMessage,
                        scope,
                    })
                } else {
                    const lastBump = bumps.slice(-1)[0]!
                    bumps.splice(bumps.length - 1, 1, {
                        ...lastBump,
                        bumpLevel,
                        notesRule,
                        rawMessage: lastBump.rawMessage + '\n' + rawMessage,
                    })
                }
            }
            for (const { bumpLevel, notesRule, rawMessage, scope } of bumps) {
                if (!releaseNotes[notesRule]) releaseNotes[notesRule] = []
                // releaseNotes[notesRule]!.push({ message: processCommitMessage(rawMessage), scope })
                const message = processCommitMessage(rawMessage, commitSha)
                // commit sha undefined mostly on testing
                releaseNotes[notesRule]!.push(scope ? `**${scope}**: ${message}` : message)
                if (bumpLevel < resolvedBumpLevel) continue
                resolvedBumpLevel = bumpLevel
            }
        }
        // TODO respect order config with l
        let nextVersion: undefined | string
        let bumpType = getBumpTypeByPriority(resolvedBumpLevel)
        if (bumpType === undefined || config.bumpingVersionStrategy === 'none') {
        } else {
            const strategyConfig = versionBumpingStrategies[config.bumpingVersionStrategy]
            if (strategyConfig.isAppliable && !strategyConfig.isAppliable(tagVersion)) {
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
}
