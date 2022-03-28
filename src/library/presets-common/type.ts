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
    versionBumpInfo: NextVersionResult | undefined
    presetConfig: PresetSpecificConfigs[T]
}

export type OutputData = {
    assets?: Array<{ name: string; path: string }>
    postRun?: (octokit: Octokit, packageJson: PackageJson) => any
    jsonFilesFieldsToRemove?: {
        [relativePath: string]: Set<string>
    }
}

export type PresetMain<T extends GlobalPreset> = (data: InputData<T>) => Promise<void | OutputData>

export type PresetExports = { main: PresetMain<any> }
