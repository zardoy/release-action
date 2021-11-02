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
    assets: { name: string; path: string }[]
}

export type PresetExports = { main: PresetMain }

export type PresetMain = (data: InputData) => Promise<OutputData>

// I don't think it's safe
/** pipes output */
export const safeExeca = async (command: string, args: string | string[]) => {
    await execa(command, Array.isArray(args) ? args : args.split(' '), {
        stdio: 'inherit',
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
    }
    // TODO run eslint with no-op
}
