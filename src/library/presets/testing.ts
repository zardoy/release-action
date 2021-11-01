// preset for testing in real repository

import { readPackageJsonFile } from 'typed-jsonfile'
import { InputData } from './shared'

export const main = async ({ repo }: InputData) => {
    console.log('Publishing version', (await readPackageJsonFile({ dir: '.' })).version, repo.url)
}
