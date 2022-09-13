import urlJoin from 'url-join'
import { queryRepositoryReleases } from './queryRepositoryReleases'
import { OctokitRepoWithUrl } from './types'

const RELEASES_LIMIT = 100

interface Options {
    // lowerHeading?: false,
}

export interface ReleasingChangelog {
    version: string
    changelog: string
    /** Used for testing only */
    date?: Date
}

export const extractChangelogFromGithub = async (repo: OctokitRepoWithUrl, releasingChangelog: ReleasingChangelog, _options: Options = {}) => {
    // eslint-disable-next-line arrow-body-style
    const replaceHashAndIssues = (input: string) => {
        return input
            .replace(/(?<= )[\da-f]{40}\b/g, sha => `[\`${sha.slice(0, 7)}\`](${repo.url}/commit/${sha})`)
            .replace(/#(\d+)\b/g, (match, issueOrPrNum) => `[${match}](${repo.url}/issues/${issueOrPrNum})`)
    }

    const releasingTag = `v${releasingChangelog.version}`
    const releasingRelease = {
        createdAt: releasingChangelog.date || new Date(),
        name: releasingTag,
        tagName: releasingTag,
        description: releasingChangelog.changelog,
    }
    const { totalCount, releases } = await queryRepositoryReleases(repo)
    let markdown = ''
    for (const { createdAt, name, tagName, description } of [releasingRelease, ...releases]) {
        const dateFormatted = new Date(createdAt).toISOString().split('T')[0]!
        markdown += `\n\n## [${name}](${urlJoin(repo.url, 'releases/tag', tagName)}) - ${dateFormatted}\n${replaceHashAndIssues(description)}`
    }

    if (totalCount > RELEASES_LIMIT)
        markdown += `[size optimization] The list has truncated another ${RELEASES_LIMIT - totalCount} releases. You can view them on [GitHub](${urlJoin(
            repo.url,
            'releases',
        )})`
    return { totalCount, markdown }
}
