import { endGroup, startGroup } from '@actions/core'
import execa from 'execa'
import { sharedConfig } from './config'

export const execAsStep = async (command: string, args: string | string[], options: execa.Options = {}) => {
    startGroup(`${command} ${Array.isArray(args) ? args.join(' ') : args}`)
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

export const execPnpmScript = async (args: string, command = 'pnpm') => {
    if (sharedConfig.skipScripts) {
        console.log(`[info] ${command} ${args} skipped (skipScripts)`)
        return
    }

    return execAsStep(command, args)
}

export const getPmVersion = async (pm: 'pnpm') => {
    try {
        const cmd = await execa(pm, ['--version'])
        return cmd.stdout
    } catch {
        return undefined
    }
}

export const installGlobalWithPnpm = async (packages: string[], asStep = true) => {
    const pnpmVersion = await getPmVersion('pnpm')
    if (pnpmVersion!.split('.')[0]! === '7')
        try {
            await execa('pnpm', ['root', '-g'])
        } catch {
            await execa('pnpm', ['setup'])
        }

    await (asStep ? execAsStep : execa)('pnpm', ['i', '-g', ...packages])
}
