import urlJoin from 'url-join'
import { queryRepositoryReleases } from './queryRepositoryReleases'
import { OctokitRepoWithUrl } from './types'

const RELEASES_LIMIT = 100

interface Options {
    // lowerHeading?: false,
}

export const extractChangelogFromGithub = async (repo: OctokitRepoWithUrl, _options: Options = {}) => {
    // eslint-disable-next-line arrow-body-style
    const replaceHashAndIssues = (input: string) => {
        return input
            .replace(/(?<= )[\da-f]{40}\b/g, sha => `[\`${sha.slice(0, 7)}\`](${repo.url}/commit/${sha})`)
            .replace(/#(\d+)\b/g, (match, issueOrPrNum) => `[${match}](${repo.url}/issues/${issueOrPrNum}})`)
    }

    const { totalCount, releases } = await queryRepositoryReleases(repo)
    let markdown = ''
    for (const { createdAt, name, tagName, description } of releases) {
        const dateFormatted = new Date(createdAt).toISOString().split('T')[0]!
        markdown += `\n## [${name}](${urlJoin(repo.url, 'releases/tag', tagName)}) - ${dateFormatted}\n${replaceHashAndIssues(description)}`
    }

    if (totalCount > RELEASES_LIMIT)
        markdown += `[size optimization] The list has truncated another ${RELEASES_LIMIT - totalCount} releases. You can view them on [GitHub](${urlJoin(
            repo.url,
            'releases',
        )})`
    return { totalCount, markdown }
}
