import { Octokit } from '@octokit/rest'
import execa from 'execa'
import { afterEach, beforeEach, vi } from 'vitest'
import { program } from '../build/main.js'
import { trackExecaCalls } from './execaHelpers.js'
import { setupOctokitMock } from './helpers.js'
import { getFixtureSetuper } from './setupFixture.js'

vi.mock('@octokit/rest', () => ({
    Octokit: vi.fn(),
}))

vi.mock('execa', () => ({
    default: vi.fn(),
}))

const originalCwd = process.cwd()

beforeEach(() => {
    vi.mocked(execa).mockReset()
    vi.mocked(Octokit).mockReset()
})

afterEach(() => {
    process.chdir(originalCwd)
    vi.clearAllMocks()
})

// Min test, have no idea how to make it more comprehensive

test('MONOREPO PRESET!', async () => {
    const { setupFixture } = getFixtureSetuper('vscode-framework', 'zardoy/vscode-framework#3089b3e722215e1e70edf05843e37be42ff4e1f7')
    await setupFixture()
    const { calledMethods } = setupOctokitMock(vi.mocked(Octokit))
    const { noStdio, getCalls } = trackExecaCalls(vi.mocked(execa))

    await program.parseAsync(['pnpm-monorepo'], { from: 'user' })

    expect(noStdio).toMatchInlineSnapshot(`[]`)
    expect(getCalls()).toMatchInlineSnapshot(`
      [
        [
          "pnpm run build",
          {
            "env": {
              "GITHUB_TOKEN": undefined,
              "NPM_TOKEN": undefined,
              "PAT": undefined,
            },
          },
        ],
        [
          "pnpm test",
          {
            "env": {
              "GITHUB_TOKEN": undefined,
              "NPM_TOKEN": undefined,
              "PAT": undefined,
            },
          },
        ],
        [
          "pnpm publish --access public -r --no-git-checks --tag next",
          {},
        ],
      ]
    `)
    expect(calledMethods).toMatchInlineSnapshot(`
      [
        "repos.get",
      ]
    `)
})

test.todo('VSIX PRESET! — needs vsce and @octokit/graphql mocks for vscode-extension')
