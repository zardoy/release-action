/* eslint-disable arrow-body-style */
import { PackageJson, TsConfigJson } from 'type-fest'
import { RepoInfo } from 'github-remote-info'
import remark from 'remark'

type PlaceholderCallback = (data: { packageJson: PackageJson; tsconfigJson: TsConfigJson; originInfo: RepoInfo }) => string | Promise<string>

const makePlaceholders = <T extends Record<string, PlaceholderCallback>>(placeholders: T) => placeholders

const placeholders = makePlaceholders({
    '[[paka-docs]]': ({ packageJson }) => {
        // TODO maybe text: Docs
        return `[API](https://paka.dev/npm/${packageJson.name!})`
    },
})

/** removes whole section with selected heading */
export const markdownRemoveHeading = async (markdown: string, headingToRemove: string) => {
    return remark()
        .use(() => {
            return rootNode => {
                //@ts-expect-error TODO update remark when esm issues with jest are resolved
                const { children } = rootNode
                const headingToRemoveIndex = children.findIndex(node => {
                    if (node.type !== 'heading' || node.depth !== 2) return false
                    const headingText = node.children[0]!
                    return headingText.type === 'text' && headingText.value === headingToRemove
                })
                if (headingToRemoveIndex === -1) return rootNode

                children.splice(headingToRemoveIndex, 1)
                for (let i = headingToRemoveIndex; i < children.length; i++) {
                    const node = children[i]!
                    if (node.type === 'heading' && node.depth <= 2) break
                    children.splice(i, 1)
                    i--
                }

                return rootNode
            }
        })
        .process(markdown)
        .then(file => String(file))
}
