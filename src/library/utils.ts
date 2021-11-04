import { endGroup, startGroup } from '@actions/core'
import execa from 'execa'

export const execAsStep = async (command: string, args: string, options: execa.Options = {}) => {
    startGroup(`${command} ${args}`)
    await execa(command, Array.isArray(args) ? args : args.split(' '), {
        stdio: 'inherit',
        ...options,
        env: {
            NPM_TOKEN: undefined,
            GITHUB_TOKEN: undefined,
            PAT: undefined,
        } as any,
    })
    endGroup()
}
