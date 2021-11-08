import { PackageJson, SetRequired } from 'type-fest'
import { readPackageJsonFile } from 'typed-jsonfile'

export const readRootPackageJson = async () => readPackageJsonFile({ dir: '.' }) as Promise<SetRequired<PackageJson, 'name'>>
