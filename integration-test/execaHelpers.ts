import lodash from 'lodash'
import type { Mock } from 'vitest'

export const trackExecaCalls = (execaMock: Mock) => {
    const noStdio: unknown[][] = []
    execaMock.mockImplementation(async (cmd: string, args: string[], { stdio }: { stdio?: unknown } = {}) => {
        if (!stdio) noStdio.push([cmd, args])
    })

    const getCalls = () =>
        execaMock.mock.calls.map(([cmd, args, opts]) => [
            `${cmd} ${(args as string[]).join(' ')}`,
            lodash.omit(opts as Record<string, unknown>, 'stdio'),
        ])

    return { noStdio, getCalls }
}
