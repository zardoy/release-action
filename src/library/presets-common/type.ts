// Types of presets exports

import { Octokit } from '@octokit/rest'
import { PackageJson } from 'type-fest'
import { NextVersionReturn as NextVersionResult } from '../bumpVersion'
import { GlobalPreset, PresetSpecificConfigs } from '../config'

export type InputData<T extends GlobalPreset> = {
    repo: {
        url: string
        octokit: Record<'repo' | 'owner', string>
    }
    octokit: Octokit
    newVersion: string
    versionBumpInfo: NextVersionResult
    presetConfig: PresetSpecificConfigs[T]
}

export type OutputData = void | {
    assets?: Array<{ name: string; path: string }>
    postRun?: (octokit: Octokit, packageJson: PackageJson) => any
    packageJsonFieldsRemove?: string[]
}

export type PresetMain<T extends GlobalPreset> = (data: InputData<T>) => Promise<OutputData>

export type PresetExports = { main: PresetMain<any> }
