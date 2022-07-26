import { graphql } from '@octokit/graphql';
import { OctokitRepo } from './types';

export const queryRepositoryReleases = async (
    repo: OctokitRepo
): Promise<{ totalCount: number; releases: Array<{ createdAt: number; name: string; tagName: string; description: string; }>; }> => {
    const graphqlQuery = graphql.defaults({
        headers: {
            authorization: `token ${process.env.GITHUB_TOKEN}`,
        },
    });
    const gql = String.raw;
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
        }
    );
    const { totalCount, nodes: releases } = data.repository.releases;
    return { totalCount, releases };
};
