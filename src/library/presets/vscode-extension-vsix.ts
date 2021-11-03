// Don't publish extension and attach `.vsix` asset to every release instead

import { readPackageJsonFile } from 'typed-jsonfile'
import { InputData, OutputData } from './shared'
import { sharedMain } from './vscode-extension'

export const main = async (input: InputData<'vscode-extension-vsix'>): Promise<OutputData> => {
    const { vsixPath } = await sharedMain(input)
    const { publisher, name, version } = (await readPackageJsonFile({ dir: '.' })) as any
    return {
        assets: [
            {
                name: `${name!}-${version}.vsix`,
                path: vsixPath,
            },
        ],
    }
}
