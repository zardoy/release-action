import * as typedJsonFile from 'typed-jsonfile'
import { getNextVersionAndReleaseNotes } from '../src/library/bumpVersion'
import { defaultConfig } from '../src/library/config'
import { getMockedOctokit } from './utils'

export type Commit = {
    message: string
    sha?: string
}

const dummyRepo = { owner: 'user', repo: 'repository' }

const args = {
    config: defaultConfig,
    repo: dummyRepo,
}

const getVersionBumpFromCommits = async (commits: Array<string | Commit>, version = 'v0.0.9') => {
    const { latestTagCommitSha, ...data } = await getNextVersionAndReleaseNotes({
        octokit: getMockedOctokit(
            [{ name: version as `v${string}`, commit: { sha: '123' } }],
            [
                ...commits,
                {
                    message: 'feat: should not be here',
                    sha: '123',
                },
            ],
        ),

        ...args,
    })
    return data
}

const mockPackageJsonOnce = (packageJson: Record<string, any>) => {
    const spy = vi.spyOn(typedJsonFile, 'readPackageJsonFile')
    spy.mockResolvedValueOnce(JSON.parse(JSON.stringify(packageJson)))
}

// TODO try to extract to fixtures for reuse

vi.mock('typed-jsonfile')

test('Initial release', async () => {
    mockPackageJsonOnce({
        private: true,
        version: '0.0.0',
    })
    expect(
        await getNextVersionAndReleaseNotes({
            octokit: getMockedOctokit([], ['feat: something added']),
            ...args,
        }),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "none",
        "commitsByRule": {
          "rawOverride": "🎉 Initial release",
        },
        "nextVersion": "0.0.1",
      }
    `)
})

test('Just bumps correctly', async () => {
    expect(
        await getVersionBumpFromCommits([
            'fix: fix serious issue\nfeat: add new feature',
            // TODO should be published only at this point
            '[publish] feat: just adding feature',
            '[skip ci] feat: just adding another feature (but making available on next commit)',
            // just ignored
            'WIP fix: first fixes',
        ]),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "patch",
        "commitsByRule": {
          "minor": [
            "add new feature",
            "just adding feature",
            "just adding another feature (but making available on next commit)",
          ],
          "patch": [
            "fix serious issue",
          ],
        },
        "latestTagName": "v0.0.9",
        "nextVersion": "0.0.10",
      }
    `)
})

test('No version bump', async () => {
    expect(
        //
        await getVersionBumpFromCommits(['fix serious issue\nfeature something new']),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "none",
        "commitsByRule": {},
        "latestTagName": "v0.0.9",
        "nextVersion": undefined,
      }
    `)
})

test('Just bumps correctly when stable', async () => {
    expect(
        await getVersionBumpFromCommits(
            //
            ['fix: fix serious issue\nfeat: add new feature', 'feat: just adding feature', 'fix: first fixes'],
            'v1.0.9',
        ),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "minor",
        "commitsByRule": {
          "minor": [
            "add new feature",
            "just adding feature",
          ],
          "patch": [
            "fix serious issue",
            "first fixes",
          ],
        },
        "latestTagName": "v1.0.9",
        "nextVersion": "1.1.0",
      }
    `)
})

test("Doesn't pick commits below version", async () => {
    expect(
        await getVersionBumpFromCommits(
            [
                'fix: fix serious issue\nfeat: add new feature',
                'feat: just adding feature',
                'fix: first fixes',
                {
                    message: 'feat: should not be here',
                    sha: '123',
                },

                {
                    message: 'feat: should not be here',
                    sha: '3213',
                },

                'feat: something else',
            ],
            'v1.0.9',
        ),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "minor",
        "commitsByRule": {
          "minor": [
            "add new feature",
            "just adding feature",
          ],
          "patch": [
            "fix serious issue",
            "first fixes",
          ],
        },
        "latestTagName": "v1.0.9",
        "nextVersion": "1.1.0",
      }
    `)
})

test('BREAKING gives major', async () => {
    expect(
        await getVersionBumpFromCommits(
            [
                'fix: fix serious issue\nfeat: add new feature\nBREAKING config was removed',
                "feat: just adding feature\nBREAKING we broke anything\nfeat: but here we didn't break anything",
                'fix: first fixes',
            ],
            'v1.0.9',
        ),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "major",
        "commitsByRule": {
          "major": [
            "add new feature
      config was removed",
            "just adding feature
      we broke anything",
          ],
          "minor": [
            "but here we didn't break anything",
          ],
          "patch": [
            "fix serious issue",
            "first fixes",
          ],
        },
        "latestTagName": "v1.0.9",
        "nextVersion": "2.0.0",
      }
    `)
})

test('BREAKING gives major on unstable', async () => {
    expect(
        await getVersionBumpFromCommits(
            [
                'fix: fix serious issue\nfeat: add new feature\nBREAKING config was removed',
                'feat: just adding feature\nBREAKING we broke anything',
                'fix: first fixes',
            ],
            'v0.0.7',
        ),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "minor",
        "commitsByRule": {
          "major": [
            "add new feature
      config was removed",
            "just adding feature
      we broke anything",
          ],
          "patch": [
            "fix serious issue",
            "first fixes",
          ],
        },
        "latestTagName": "v0.0.7",
        "nextVersion": "0.1.0",
      }
    `)
})

test('Extracts scopes correctly', async () => {
    expect(
        await getVersionBumpFromCommits(
            [
                'fix: fix serious issue\nfeat: add new feature\nBREAKING config was removed',
                'feat(button): just adding feature\nBREAKING we broke anything',
                "fix: some things\nfeat(button): we're insane!\nNote: yes, we are!\n",
                // IGNORED!
                'fix(npm & pnpm preset): another fixes',
                'fix(library-action): first fixes',
            ],
            'v0.0.7',
        ),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "minor",
        "commitsByRule": {
          "major": [
            "add new feature
      config was removed",
            "**button**: just adding feature
      we broke anything",
          ],
          "minor": [
            "**button**: we're insane!",
          ],
          "patch": [
            "fix serious issue",
            "some things",
            "**library-action**: first fixes",
          ],
        },
        "latestTagName": "v0.0.7",
        "nextVersion": "0.1.0",
      }
    `)
})

test("Extracts sha's correctly", async () => {
    expect(
        await getVersionBumpFromCommits([
            "fix: something fixed but we don't care",
            {
                message: 'fix: fix serious issue\nfeat: add new feature\nBREAKING config was removed',
                sha: '7f8468286354936e8817607d7a2087715bbe1854',
            },

            {
                message: 'fix: something was contributed (#123)',
                sha: '7f8468286354936e8817607d7a2087715bbe1854',
            },
        ]),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "minor",
        "commitsByRule": {
          "major": [
            "add new feature
      config was removed 7f8468286354936e8817607d7a2087715bbe1854",
          ],
          "patch": [
            "something fixed but we don't care",
            "fix serious issue 7f8468286354936e8817607d7a2087715bbe1854",
            "something was contributed (#123)",
          ],
        },
        "latestTagName": "v0.0.9",
        "nextVersion": "0.1.0",
      }
    `)
})

// TODO
test.skip('Strips empty lines', async () => {
    expect(
        await getVersionBumpFromCommits([
            {
                message: `feat: add support for reading jsonc files
By default it's enabled when path ends with \`.jsonc\`
feat: options must be object and not null or string
BREAKING
fix(types): allow to omit 2nd arg for \`readTsconfigJsonFile\`
`,
                sha: '328',
            },
            {
                message: 'feat: should not be here',
                sha: '123',
            },
        ]),
    ).toMatchInlineSnapshot(``)
})

test('Extracts conventional commit info', async () => {
    expect(
        //
        await getVersionBumpFromCommits(["fix: TypeError: Cannot read property 'nextVersion' of undefined NPM Release"]),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "patch",
        "commitsByRule": {
          "patch": [
            "TypeError: Cannot read property 'nextVersion' of undefined NPM Release",
          ],
        },
        "latestTagName": "v0.0.9",
        "nextVersion": "0.0.10",
      }
    `)
})

// give better name to the test?
test('Operates on description properly', async () => {
    const includeCommit = `
fix: This rare bug was finally fixed closes #33343

Some background for bug goes here...
feat: Add new feature within commit
Description`
    /** only fix should be included, but not test */
    const notIncludeCommit = `
fix: This rare bug was finally fixed fixes #33343

fixes #453
Some background for bug goes here...
test: Fix tests
Tests were hard to fix`

    expect(
        //
        await getVersionBumpFromCommits([includeCommit, notIncludeCommit, 'fix: first fixes'], 'v1.0.9'),
    ).toMatchInlineSnapshot(`
      {
        "bumpType": "minor",
        "commitsByRule": {
          "minor": [
            "Add new feature within commit
      Description",
          ],
          "patch": [
            "This rare bug was finally fixed
      Some background for bug goes here... (#33343)",
            "This rare bug was finally fixed

      Some background for bug goes here... (#33343, #453)",
            "first fixes",
          ],
        },
        "latestTagName": "v1.0.9",
        "nextVersion": "1.1.0",
      }
    `)
})

test('Pick all commits even if they are > 100', async () => {
    const { commitsByRule } = await getNextVersionAndReleaseNotes({
        octokit: {
            repos: {
                async listTags() {
                    return { data: [{ name: 'v0.0.1', commit: { sha: '123' } }] }
                },
                async listCommits({ page }) {
                    let commits: { sha: string; commit: { message: string } }[] = []
                    if (page === 1) {
                        commits = Array.from({ length: 100 }, (_, i) => ({
                            commit: { message: `fix: ${i}` },
                            sha: '',
                        }))
                    } else if (page === 2) {
                        commits = Array.from({ length: 100 }, (_, i) => ({
                            commit: { message: `feat: ${i}` },
                            sha: '',
                        }))
                        commits.push({
                            commit: { message: 'feat: not included' },
                            sha: '123',
                        })
                    }
                    return { data: commits }
                },
            },
        } as any,
        ...args,
    })
    expect(commitsByRule['patch']).toHaveLength(100)
    expect(commitsByRule['minor']).toHaveLength(100)
})
