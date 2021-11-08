import { join } from 'path'
import fs from 'fs'
import { PackageJson } from 'type-fest'
import { readPackageJsonFile, writePackageJsonFile } from 'typed-jsonfile'
import got from 'got'
import execa from 'execa'
import type { Options } from 'mdast-util-to-markdown'
import remark from 'remark'
import { endGroup, startGroup } from '@actions/core'
import { OutputData, PresetMain } from '../presets-common/type'
import { generateNpmPackageJsonFields } from '../presets-common/generatePackageJsonFields'

export const main: PresetMain<'pnpm-monorepo'> = async ({ octokit, repo, presetConfig }) => {
    const mainPackage = presetConfig.mainPackage ?? repo.octokit.repo
    const fieldsToRemovePerDir: OutputData['jsonFilesFieldsToRemove'] = {}

    const fromMonorepo = (...p: string[]) => join('packages', ...p)
    for (const monorepoPackage of await fs.promises.readdir(fromMonorepo())) {
        const fromPackage = (...p: string[]) => join('packages', monorepoPackage, ...p)
        if (!fs.existsSync(fromPackage('package.json'))) continue
        const { private: pkgPrivate } = await readPackageJsonFile({ dir: fromPackage() })
        if (pkgPrivate) continue
        const { packageJson, fieldsToRemove } = await generateNpmPackageJsonFields(fromPackage(), presetConfig, repo.url)
        // #region Quality Checks
        if (monorepoPackage !== packageJson.name)
            throw new Error(`Package ${monorepoPackage} should have the same name in it's package.json (got ${packageJson.name!})`)
        // #endregion
        fieldsToRemovePerDir[fromPackage()] = fieldsToRemove
        // is there any other method to detect that e.g. changes of current commit?
        const {
            body: { version: publishedVersion },
        } = await got<PackageJson>(`https://cdn.jsdelivr.net/npm/${monorepoPackage}/package.json`, { responseType: 'json' })
        if (packageJson.version === publishedVersion) {
            console.log(`No version bump in ${monorepoPackage}, skipping`)
            continue
        }

        if (monorepoPackage === mainPackage) {
            const latestReleaseBody = await getLatestReleaseBody(
                await fs.promises.readFile(fs.existsSync(fromPackage('CHANGELOG.MD')) ? fromPackage('CHANGELOG.MD') : fromPackage('CHANGELOG.md'), 'utf-8'),
            )
            await octokit.repos.createRelease({
                ...repo.octokit,
                tag_name: packageJson.version!,
                body: `<!-- npm:${monorepoPackage} -->\n${latestReleaseBody}`,
            })
        }
    }

    startGroup('publish')
    await execa('pnpm', [...'publish --access public -r --no-git-checks --tag'.split(' '), presetConfig.publishTag], { stdio: 'inherit' })
    endGroup()

    return {
        jsonFilesFieldsToRemove: fieldsToRemovePerDir,
    }
}

export const getLatestReleaseBody = async (changelogMarkdown: string) =>
    remark()
        .use(() => rootNode => {
            // @ts-expect-error TODO update remark when esm issues with jest are resolved
            const { children } = rootNode
            const firstHeading2Index = children.findIndex(node => node.type === 'heading' && node.depth === 2) as number
            let headingBody = children.slice(firstHeading2Index + 1)
            const secondHeading2Index = headingBody.findIndex(node => node.type === 'heading' && node.depth === 2)
            if (secondHeading2Index > 0) headingBody = headingBody.slice(0, secondHeading2Index)
            // @ts-expect-error
            rootNode.children = headingBody
            return rootNode
        })
        // @ts-expect-error
        .use({ settings: { bullet: '-' } as Options })
        .process(changelogMarkdown)
        .then(file => String(file))
