import execa from 'execa'

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

export const runTests = async (required = false) => {
    await safeExeca('pnpm', 'test')
    // TODO run eslint with no-op
}
