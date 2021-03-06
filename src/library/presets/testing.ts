// preset for testing in real repository

import { readPackageJsonFile } from 'typed-jsonfile'
import { InputData } from '../presets-common/type'

export const main = async ({ repo }: InputData<any>) => {
    console.log('Publishing version', (await readPackageJsonFile({ dir: '.' })).version, repo.url)
}
