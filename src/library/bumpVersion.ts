import { Octokit, RestEndpointMethodTypes } from '@octokit/rest'
import { ReleaseType, major } from 'semver'
import { Config } from './config'
import { OctokitRepo } from './types'

export type SemverVersionString = `${number}.${number}.${number}` | `${number}.${number}.${number}-${string}`

type BasicReleaseType = 'patch' | 'minor' | 'major'

interface NotesRule {
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

const notesRules: Record<string, Record<string, NotesRule>> = {
    default: {
        patch: {
            groupTitle: 'Bug Fixes',
        },
        minor: {
            groupTitle: 'New Features',
        },
        major: {
            groupTitle: 'BREAKING CHANGES',
        },
    },
}

interface VersionRule {
    regex: RegExp
    bump: false | ReleaseType
    /** otherwise `bump` is used by default */
    notesRule?: string
}

const versionRules: VersionRule[] = [
    // TODO skip release
    {
        regex: /^fix:/,
        bump: 'patch',
    },
    {
        regex: /^feat:/,
        bump: 'minor',
    },
    {
        regex: /BREAKING CHANGE/,
        bump: 'major',
    },
]

const versionPriority: Record<BasicReleaseType | 'none', number> = {
    none: 0,
    patch: 1,
    minor: 2,
    major: 3,
}

type VersionMap = Record<BasicReleaseType, BasicReleaseType> & {
    /** @default Always appliable */
    isAppliable?: (version: string) => boolean
}
export const makeVersionMaps = <T extends string>(versionsMaps: Record<T, VersionMap>) => versionsMaps

/** Opiniated too */
export const versionMaps = makeVersionMaps({
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

type BumpVersionConfig = Pick<Config, 'bumpingVersionStrategy' | 'initialVersion'>

type BumpVersionParams = {
    octokit: Octokit
    repo: OctokitRepo
    config: BumpVersionConfig
}

interface NextVersionReturn {
    bumpLevel: number
    bumpType: BasicReleaseType | 'none'
    nextVersion: string
    /** `{[noteRule: string]: commitMessages[]}` */
    commitMessagesByNoteRule: {
        [noteRule: string]: string[]
    }
}

export const getNextVersionAndReleaseNotes = async ({ octokit, repo, config }: BumpVersionParams): Promise<NextVersionReturn> => {
    const { data: tags } = await octokit.repos.listTags({
        ...repo,
        per_page: 1,
    })
    const noTags = tags.length === 0
    if (noTags) {
        return {
            bumpLevel: 0,
            bumpType: 'none',
            nextVersion: config.initialVersion.version,
            commitMessagesByNoteRule: { rawOverride: [config.initialVersion.releaseNotes] },
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

export const getNextVersionAndReleaseNotesFromTag = async ({
    tag: { commitSha: tagCommitSha, version: tagVersion },
    octokit,
    repo,
    config,
}: { tag: Record<'version' | 'commitSha', string> } & BumpVersionParams): Promise<NextVersionReturn> => {
    let commits: RestEndpointMethodTypes['repos']['listCommits']['response']['data'] = []
    for (let i = 1; true; i++) {
        const { data: justFetchedCommits } = await octokit.repos.listCommits({
            ...repo,
            page: i,
        })
        commits = [...commits, ...justFetchedCommits]
        const tagCommitIndex = justFetchedCommits.findIndex(c => c.sha === tagCommitSha)
        if (tagCommitIndex === -1) continue
        const commitsBeforeTag = commits.slice(0, commits.length - justFetchedCommits.length + tagCommitIndex)
        const commitMessagesBeforeTag = commitsBeforeTag.map(c => c.commit.message)
        let finalBumpLevel = 0
        const releaseNotes: NextVersionReturn['commitMessagesByNoteRule'] = {}
        commit: for (const commitMessage of commitMessagesBeforeTag) {
            let commit = {
                bumpLevel: 0,
                // taked care of that
                notesRule: null as string | null,
            }
            for (const versionRule of versionRules) {
                if (!commitMessage.match(versionRule.regex)) continue
                if (versionRule.bump === false) continue commit
                const notesRule = versionRule.notesRule ?? versionRule.bump
                const currentPriority = versionPriority[versionRule.bump]
                if (currentPriority < commit.bumpLevel) continue
                commit = {
                    bumpLevel: currentPriority,
                    notesRule,
                }
            }
            if (!commit.notesRule) continue
            const { bumpLevel, notesRule } = commit
            if (!releaseNotes[notesRule]) releaseNotes[notesRule] = []
            releaseNotes[notesRule]!.push(commitMessage)
            if (bumpLevel < finalBumpLevel) continue
            finalBumpLevel = bumpLevel
        }
        let nextVersion: string | undefined
        if (config.bumpingVersionStrategy !== 'none') {
            for (const [mapName, versionMap] of Object.entries(versionMaps)) {
                if (versionMap.isAppliable && !versionMap.isAppliable(tagVersion)) continue
                nextVersion =
            }
        }
        return {
            bumpLevel: finalBumpLevel,
            bumpType: Object.entries(versionPriority).find(([, n]) => n === finalBumpLevel)![0],
            nextVersion: 0,
            commitMessagesByNoteRule: releaseNotes,
        }
    }
}
