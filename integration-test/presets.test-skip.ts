import Octokiting from '@octokit/rest'
import execa from 'execa'
import { omit } from 'lodash'
import { program } from '../src/library/main'
import { getMockedOctokit } from '../test/utils'
import { getFixtureSetuper } from './setupFixture'

// Min test, have no idea how to make it more comprehensive

test('MONOREPO PRESET!', async () => {
    const { setupFixture } = getFixtureSetuper('vscode-framework', 'zardoy/vscode-framework#3089b3e722215e1e70edf05843e37be42ff4e1f7')
    setupFixture()
    console.log('monorepo', process.cwd())
    const octokitSpy = jest.spyOn(Octokiting, 'Octokit')
    const octo = getMockedOctokit([{ commit: { sha: '123' }, name: 'v0.0.9' }], ["fix: ignored\nfeat:don't care\nBREAKING", { message: 'Never.', sha: '123' }])
    const calledMethods: string[] = []
    //@ts-ignore
    octokitSpy.mockImplementationOnce(() => {
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
                                        octo.repos[method]
                                        break
                                    case 'repos.createRelease':
                                        return async () => {}
                                    case 'repos.uploadReleaseAsset':
                                        return async () => {}
                                    case 'repos.update':
                                        return async () => {}
                                    case 'repos.get':
                                        return async () => {
                                            return {
                                                homepage: '',
                                                topics: '',
                                                description: '',
                                            }
                                        }

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
    octokitSpy.mockImplementation(() => {
        throw new Error('Should be called only once')
    })
    const execaSpy = jest.spyOn(execa as any, 'execa')
    const noStdio = [] as any[][]
    //@ts-ignore
    execaSpy.mockImplementation(async (cmd, args, { stdio } = {}) => {
        if (!stdio) noStdio.push([cmd, args])
        //@ts-ignore
        // if (`${cmd} ${args.join(" ")}`.startsWith("pnpm publish")) {
        //   //@ts-ignore
        //   const { stdout } = await execa.realExeca(cmd, [...args, "--dry-run"]);
        // }
    })
    await program.parseAsync(['pnpm-monorepo'], { from: 'user' })
    expect(noStdio).toMatchInlineSnapshot(`Array []`)
    expect(
        execaSpy.mock.calls.map(([cmd, args, opts]) => [
            //@ts-ignore
            `${cmd} ${args.join(' ')}`,
            //@ts-ignore
            omit(opts, 'stdio'),
        ]),
    ).toMatchInlineSnapshot(`
    Array [
      Array [
        "pnpm run build",
        Object {
          "env": Object {
            "GITHUB_TOKEN": undefined,
            "NPM_TOKEN": undefined,
            "PAT": undefined,
          },
        },
      ],
      Array [
        "pnpm test",
        Object {
          "env": Object {
            "GITHUB_TOKEN": undefined,
            "NPM_TOKEN": undefined,
            "PAT": undefined,
          },
        },
      ],
      Array [
        "pnpm publish --access public -r --no-git-checks --tag next",
        Object {},
      ],
    ]
  `)
    expect(calledMethods).toMatchInlineSnapshot(`
    Array [
      "repos.get",
    ]
  `)
})

test('VSIX PRESET!', async () => {
    const { setupFixture } = getFixtureSetuper('github-manager', 'zardoy/github-manager#909222a16963227221640a4df400ef1ace7b2890')
    setupFixture()
    console.log('vscode', process.cwd())
    const octokitSpy = jest.spyOn(Octokiting, 'Octokit')
    const octo = getMockedOctokit([{ commit: { sha: '123' }, name: 'v0.0.9' }], ["fix: ignored\nfeat:don't care\nBREAKING", { message: 'Never.', sha: '123' }])
    const calledMethods: string[] = []
    //@ts-ignore
    octokitSpy.mockImplementationOnce(() => {
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
                                        octo.repos[method]
                                        break
                                    case 'repos.createRelease':
                                        return async () => {}
                                    case 'repos.uploadReleaseAsset':
                                        return async () => {}
                                    case 'repos.update':
                                        return async () => {}
                                    case 'repos.get':
                                        return async () => {
                                            return {
                                                homepage: '',
                                                topics: '',
                                                description: '',
                                            }
                                        }

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
    octokitSpy.mockImplementation(() => {
        throw new Error('Should be called only once')
    })
    const execaSpy = jest.spyOn(execa as any, 'execa')
    const noStdio = [] as any[][]
    //@ts-ignore
    execaSpy.mockImplementation(async (cmd, args, { stdio } = {}) => {
        if (!stdio) noStdio.push([cmd, args])
        //@ts-ignore
        // if (`${cmd} ${args.join(" ")}`.startsWith("pnpm publish")) {
        //   //@ts-ignore
        //   const { stdout } = await execa.realExeca(cmd, [...args, "--dry-run"]);
        // }
    })
    await program.parseAsync(['pnpm-monorepo'], { from: 'user' })
    expect(noStdio).toMatchInlineSnapshot(`Array []`)
    expect(
        execaSpy.mock.calls.map(([cmd, args, opts]) => [
            //@ts-ignore
            `${cmd} ${args.join(' ')}`,
            //@ts-ignore
            omit(opts, 'stdio'),
        ]),
    ).toMatchInlineSnapshot()
    expect(calledMethods).toMatchInlineSnapshot()
})
