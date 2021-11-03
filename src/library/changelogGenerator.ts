import { sortBy } from 'lodash'
import { BasicReleaseType, NextVersionReturn } from './bumpVersion'
import { Config } from './config'

// in future it will changed to string
export type NoteGeneratorName = BasicReleaseType

interface NoteGeneratorDefinition {
    heading: string
    /** @default 0 */
    order?: number
}

const makeNoteGenerators = <T extends string>(t: Record<T, Record<NoteGeneratorName, NoteGeneratorDefinition>>) => t
// style - rules
export const notesGenerators = makeNoteGenerators({
    /** almost the same as plain but will also receive several updates in future */
    default: {
        patch: {
            heading: '### Bug Fixes',
        },
        minor: {
            heading: '### New Features',
            order: -1,
        },
        major: {
            heading: '## 💥 BREAKING CHANGES',
            order: -2,
        },
    },
    plain: {
        patch: {
            heading: '### Bug Fixes',
        },
        minor: {
            heading: '### New Features',
            order: -1,
        },
        major: {
            heading: '## BREAKING CHANGES',
            order: -2,
        },
    },
    semver: {
        patch: {
            heading: '### Patch Changes',
        },
        minor: {
            heading: '### Minor Changes',
            order: -1,
        },
        major: {
            heading: '## Major Changes',
            order: -2,
        },
    },
    prisma: {
        patch: {
            heading: '### Patch Changes',
        },
        minor: {
            heading: '### Major improvements & new features',
            order: -1,
        },
        major: {
            heading: '# Breaking Changes',
            order: -2,
        },
    },
    /** obviously its a restricted version */
    gitmoji: {
        patch: {
            heading: '### 🐛 Bug Fixes',
        },
        minor: {
            heading: '## ✨ New Features',
            order: -1,
        },
        major: {
            heading: '# 💥 Breaking Changes',
            order: -2,
        },
    },
})

export const generateChangelog = (
    messagesByRule: NextVersionReturn['commitsByRule'],
    metadata: { bumpType: string; npmPackage?: string },
    config: Config,
): string => {
    if ('rawOverride' in messagesByRule) return messagesByRule.rawOverride as string
    const rulesStyle = config.changelog.style
    /** No escaping */
    const headings = [] as Array<{ order: number; markdown: string }>
    for (const [noteRule, messages] of Object.entries(messagesByRule)) {
        let markdown = ''
        const rule = notesGenerators[rulesStyle][noteRule] as NoteGeneratorDefinition
        markdown += `${rule.heading}\n\n`
        markdown += messages.map(msg => `- ${msg}`).join('\n')
        headings.push({
            markdown,
            order: rule.order ?? 0,
        })
    }

    let markdown = sortBy(headings, ({ order }) => order)
        .map(({ markdown }) => markdown)
        .join('\n')
    // TODO describe metadata in Readme. this will allow github-extra to filter out releases by type (e.g. whether they have new features or not)
    let metadataString = `bump-type:${metadata.bumpType}`
    if (metadata.npmPackage) metadataString += ` npm:${metadata.npmPackage}`
    markdown = `<!-- ${metadataString} -->\n${markdown}`
    return markdown
}
