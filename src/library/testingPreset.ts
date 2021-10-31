// preset for testing in real repository

import { readPackageJsonFile } from 'typed-jsonfile'

export const main = async ({ repoUrl }: { repoUrl: string }) => {
    console.log('Publishing version', (await readPackageJsonFile({ dir: '.' })).version, repoUrl)
}
