import { promises } from "fs"
import { Octokit } from "@octokit/rest"
import { defaultsDeep } from "lodash"
import { modifyPackageJsonFile } from "modify-json-file"
import { cosmiconfig } from "cosmiconfig"
import { readPackageJsonFile } from "typed-jsonfile"
import { getNextVersionAndReleaseNotes } from "./bumpVersion"
import { generateChangelog } from "./changelogGenerator"
import {
    Config,
    defaultConfig,
    GlobalPreset,
    presetSpecificConfigDefaults,
} from "./config"
import { PresetExports } from "./presets-common/type"
import { runSharedActions } from "./presets-common/sharedActions"
;(async () => {
    if (!process.env.GITHUB_TOKEN)
        throw new Error(
            "GITHUB_TOKEN is not defined. Make sure you pass it via env from GitHub action",
        )
    const preset = process.argv[2] as GlobalPreset
    if (!preset) throw new Error("Preset must be defined!")
    if (!process.env.CI)
        throw new Error(
            "The tools is intended to be run in GitHub action workflow",
        )
    const userConfig = await cosmiconfig("release").search()
    const config = defaultsDeep(
        userConfig?.config || {},
        defaultConfig,
    ) as Config
    config.preset = defaultsDeep(
        config.preset,
        presetSpecificConfigDefaults[preset],
    )
    const [owner, repoName] = process.env.GITHUB_REPOSITORY!.split("/")
    const repo = {
        owner: owner!,
        repo: repoName!,
    }
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
    })

    const { commitsByRule, nextVersion, bumpType } =
        await getNextVersionAndReleaseNotes({
            octokit,
            config: defaultConfig,
            repo,
        })
    if (!nextVersion) return
    const changelog = generateChangelog(
        commitsByRule,
        {
            bumpType,
            npmPackage:
                preset === "npm"
                    ? (await readPackageJsonFile({ dir: "." })).name
                    : undefined,
        },
        config,
    )
    await modifyPackageJsonFile(
        { dir: "." },
        {
            version: nextVersion,
        },
    )

    let presetToUse: PresetExports
    try {
        // eslint-disable-next-line zardoy-config/@typescript-eslint/no-require-imports
        presetToUse = require(`./presets/${preset}`) as PresetExports
    } catch (error) {
        throw new Error(`Incorrect preset ${preset}\n${error.message}`)
    }

    await runSharedActions(preset, octokit, repo)

    const result = await presetToUse.main({
        octokit,
        repo: {
            octokit: repo,
            url: `https://github.com/${repo.owner}/${repo.repo}`,
        },
        newVersion: nextVersion,
        presetConfig: config.preset,
    })

    const tagVersion = `v${nextVersion}`
    const {
        data: { id: release_id },
    } = await octokit.repos.createRelease({
        ...repo,
        tag_name: tagVersion,
        name: tagVersion,
        body: changelog,
    })

    if (result?.assets)
        for (const { path, name } of result.assets)
            await octokit.repos.uploadReleaseAsset({
                ...repo,
                data: (await promises.readFile(path)) as any,
                name,
                release_id,
            })

    if (result?.postRun)
        result.postRun(octokit, await readPackageJsonFile({ dir: "." }))
})().catch(error => {
    console.error(error)
    process.exit(1)
})
