import { endGroup, startGroup } from "@actions/core"
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"
import { defaultsDeep } from "lodash"
import { PackageJson } from "type-fest"
import { readPackageJsonFile } from "typed-jsonfile"
import { GlobalPreset } from "../config"
import { runTestsIfAny, safeExeca } from "./execute"

/** Opinionated and will be changed in future */
type SharedActions = {
    // runs before build :/
    // skips if not found
    runTest: boolean
    /**
     * - true - prepublishOnly or build
     * - enforce - enforce to have build script, throw if prepublishOnly is defined
     * - false - disable
     *   */
    runBuild: "enforce" | boolean
    updateDescription: "always" | "ifEmpty" | false
    updateKeywords: "always" | "ifEmpty" | false
    updateHomepage: false | GetHomepageLink
    generateFields: ("repository")[]
}
type MaybePromise<T> = T | Promise<T>
type RepositoryMetadata =
    RestEndpointMethodTypes["repos"]["get"]["response"]["data"]
/** Can also throw e.g. if current homepage is set */
type GetHomepageLink = (
    metadata: RepositoryMetadata,
    packageJson: PackageJson,
) => MaybePromise<string | false>

const defaults: SharedActions = {
    runTest: true,
    runBuild: false,
    updateDescription: "ifEmpty",
    updateKeywords: false,
    updateHomepage: false,
    generateFields: ["repository"]
}

const presetSpecificOverrides: Partial<
    Record<GlobalPreset, Partial<SharedActions>>
> = {
    npm: {
        runBuild: true,
        updateHomepage({ homepage }, packageJson) {
            if (homepage && !homepage.includes("npm"))
                throw new Error(
                    "Homepage must go to package on NPM. Remove homepage and rerun action",
                )
            return `https://npmjs.com/${packageJson.name!}`
        },
    },
    node: {
        runBuild: "enforce",
    },
    "vscode-extension": {
        updateHomepage({ homepage }, packageJson) {
            if (homepage && !homepage.includes("marketplace.visualstudio"))
                throw new Error("Homepage must go to extension marketplace")
            return `https://marketplace.visualstudio.com/items?itemName=${
                (packageJson as any).publisher
            }.${packageJson.name!}`
        },
    },
}

export const runSharedActions = async (
    preset: GlobalPreset,
    octokit: Octokit,
    repo: { repo: string; owner: string },
) => {
    const packageJson = await readPackageJsonFile({ dir: "." })
    const actionsConfig = defaultsDeep(
        defaults,
        presetSpecificOverrides[preset],
    ) as SharedActions
    if (actionsConfig.runTest) await runTestsIfAny()

    if (actionsConfig.runBuild) {
        const { build: buildScript, prepublishOnly } = packageJson.scripts ?? {}
        if (actionsConfig.runBuild === "enforce" && prepublishOnly)
            throw new Error(
                `Preset ${preset} can't have prepublishOnly script, use build instead`,
            )

        if (prepublishOnly) {
            startGroup("pnpm run prepublishOnly")
            await safeExeca("pnpm", "run prepublishOnly")
            endGroup()
        } else if (buildScript) {
            startGroup("pnpm run build")
            await safeExeca("pnpm", "run build")
            endGroup()
        } else {
            throw new Error(
                actionsConfig.runBuild === "enforce"
                    ? `Preset ${preset} must have build script`
                    : "Nothing to build, specify script first (prepublishOnly or build)",
            )
        }
    }

    const repositoryMetadata = (await octokit.repos.get({ ...repo })).data
    const newMetadata: Partial<
        RestEndpointMethodTypes["repos"]["update"]["parameters"]
    > = {}

    if (actionsConfig.updateDescription && packageJson.description)
        if (actionsConfig.updateDescription === "ifEmpty") {
            if (!repositoryMetadata.description)
                newMetadata.description = packageJson.description
        } else {
            newMetadata.description = packageJson.description
        }

    if (actionsConfig.updateKeywords && packageJson.keywords)
        if (actionsConfig.updateKeywords === "ifEmpty") {
            if (!repositoryMetadata.topics)
                newMetadata.topics = packageJson.keywords
        } else {
            newMetadata.topics = packageJson.keywords
        }

    if (actionsConfig.updateHomepage) {
        const newHomepage = await actionsConfig.updateHomepage(
            repositoryMetadata,
            packageJson,
        )
        if (newHomepage) newMetadata.homepage = newHomepage
    }

    if (Object.keys(newMetadata).length > 0)
        await octokit.repos.update({
            ...repo,
            ...newMetadata,
        })
}
