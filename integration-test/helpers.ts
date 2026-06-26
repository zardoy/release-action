import type { Mock } from 'vitest'
import { getMockedOctokit } from '../test/utils.js'

export const setupOctokitMock = (OctokitMock: Mock) => {
    const octo = getMockedOctokit(
        [{ commit: { sha: '123' }, name: 'v0.0.9' }],
        ["fix: ignored\nfeat:don't care\nBREAKING", { message: 'Never.', sha: '123' }],
    )
    const calledMethods: string[] = []
    OctokitMock.mockImplementationOnce(function (this: unknown) {
        return new Proxy(
            {},
            {
                get(_, group: string) {
                    return new Proxy(
                        {},
                        {
                            get(_, method: string) {
                                const fullMethod = `${group}.${method}`
                                calledMethods.push(fullMethod)
                                switch (fullMethod) {
                                    case 'repos.listCommits':
                                    case 'repos.listTags':
                                        return octo.repos[method as 'listCommits' | 'listTags']
                                    case 'repos.createRelease':
                                    case 'repos.uploadReleaseAsset':
                                    case 'repos.update':
                                        return async () => {}
                                    case 'repos.get':
                                        return async () => ({
                                            data: {
                                                homepage: '',
                                                topics: '',
                                                description: '',
                                            },
                                        })
                                    default:
                                        throw new Error(`Unknown octokit method ${fullMethod}`)
                                }
                            },
                        },
                    )
                },
            },
        )
    })
    OctokitMock.mockImplementation(() => {
        throw new Error('Should be called only once')
    })

    return { calledMethods }
}
