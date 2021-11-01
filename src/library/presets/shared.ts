import { Octokit } from '@octokit/rest'
import execa from 'execa'
import { readPackageJsonFile } from 'typed-jsonfile'

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
        extendEnv: false,
        stdio: 'inherit',
        env: {
            CI: process.env.CI,
        } as any,
    })
}

export const runTestsIfAny = async () => {
    if ((await readPackageJsonFile({ dir: '.' })).scripts?.test) await safeExeca('pnpm', 'test')
    // TODO run eslint with no-op
}
