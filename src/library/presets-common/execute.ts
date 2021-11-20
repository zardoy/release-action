import { existsSync } from 'fs'
import { startGroup, endGroup } from '@actions/core'
import execa from 'execa'
import { readPackageJsonFile } from 'typed-jsonfile'

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

export const runTestsIfAny = async () => {
    if ((await readPackageJsonFile({ dir: '.' })).scripts?.test) {
        startGroup('pnpm test')
        await safeExeca('pnpm', 'test')
        endGroup()
    } else if (existsSync('test') || existsSync('integration-test') || existsSync('integration-tests')) {
        // a check for case when tests are exist, but forgotten to setup (e.g. add test script)
        throw new Error('Test or integration-test dir exists, but not the test script')
    }
    // TODO run eslint with no-op
}
