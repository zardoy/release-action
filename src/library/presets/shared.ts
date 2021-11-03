import { existsSync } from 'fs'
import { Octokit } from '@octokit/rest'
import execa from 'execa'
import { readPackageJsonFile } from 'typed-jsonfile'
import { startGroup, endGroup } from '@actions/core'

export type InputData = {
    repo: {
        url: string
        octokit: Record<'repo' | 'owner', string>
    }
    octokit: Octokit
    newVersion: string
}

export type OutputData = void | {
    assets: Array<{ name: string; path: string }>
}

export type PresetExports = { main: PresetMain }

export type PresetMain = (data: InputData) => Promise<OutputData>

// I don't think it's safe
/** pipes output */
export const safeExeca = async (command: string, args: string | string[], options: execa.Options = {}) => {
    await execa(command, Array.isArray(args) ? args : args.split(' '), {
        stdio: 'inherit',
        ...options,
        env: {
            NPM_TOKEN: undefined,
            GITHUB_TOKEN: undefined,
            PAT: undefined,
        } as any,
    })
}

export const runBuild = async () => {
    startGroup('pnpm run build')
    await safeExeca('pnpm', 'run build')
    endGroup()
}

export const runTestsIfAny = async () => {
    if ((await readPackageJsonFile({ dir: '.' })).scripts?.test) {
        startGroup('pnpm test')
        await safeExeca('pnpm', 'test')
        endGroup()
    } else {
        // a check for case when tests are exist, but forgot to setup them (e.g. add test script)
        if (existsSync('test')) throw new Error('Test dir exists, but not the script')
    }
    // TODO run eslint with no-op
}
