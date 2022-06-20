import { graphql } from '@octokit/graphql'
import urlJoin from 'url-join'
import { OctokitRepo, OctokitRepoWithUrl } from './types'

const RELEASES_LIMIT = 100

export const queryRepositoryReleases = async (
    repo: OctokitRepo,
): Promise<{ totalCount: number; releases: Array<{ createdAt: number; name: string; tagName: string; description: string }> }> => {
    const graphqlQuery = graphql.defaults({
        headers: {
            authorization: `token ${process.env.GITHUB_TOKEN}`,
        },
    })
    const gql = String.raw
    const data = await graphqlQuery<any>(
        // eslint-disable-next-line unicorn/template-indent
        gql`
            query someRepos($owner: String!, $name: String!) {
                repository(owner: $owner, name: $name) {
                    releases(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
                        totalCount
                        nodes {
                            createdAt
                            name
                            tagName
                            description
                        }
                    }
                }
            }
        `,
        {
            owner: repo.owner,
            name: repo.repo,
        },
    )
    const { totalCount, nodes: releases } = data.repository.releases
    return { totalCount, releases }
}

export const extractChangelogFromGithub = async (repo: OctokitRepoWithUrl) => {
    // eslint-disable-next-line arrow-body-style
    const replaceHashAndIssues = (input: string) => {
        return input
            .replace(/ [\da-f]{40}\b/g, sha => `[\`${sha.slice(0, 7)}\`](${repo.url}/commit/${sha})`)
            .replace(/#(d+)\b/g, issueOrPr => `[${issueOrPr}](${urlJoin(repo.url, 'issues', issueOrPr)})`)
    }

    const { totalCount, releases } = await queryRepositoryReleases(repo)
    let markdown = ''
    for (const { createdAt, name, tagName, description } of releases) {
        const dateFormatted = new Date(createdAt).toISOString().split('T')[0]!
        markdown += `## [${name}](${urlJoin(repo.url, 'releases/tag', tagName)}) - ${dateFormatted}\n${replaceHashAndIssues(description)}`
    }

    if (totalCount > RELEASES_LIMIT)
        markdown += `[size optimization] The list has truncated another ${RELEASES_LIMIT - totalCount} releases. You can view them on [GitHub](${urlJoin(
            repo.url,
            'releases',
        )})`
    return { totalCount, markdown }
}
