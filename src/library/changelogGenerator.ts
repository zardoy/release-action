import { sortBy } from 'lodash'
import { NextVersionReturn, NotesRule } from './bumpVersion'
import { Config } from './config'

// TODO make and refs below
// TODO RENAME
// style - rules
export const notesRules: Record<string, Record<string, NotesRule>> = {
    default: {
        patch: {
            groupTitle: '### Bug Fixes',
        },
        minor: {
            groupTitle: '### New Features',
            order: -1,
        },
        major: {
            groupTitle: '## BREAKING CHANGES',
            order: -2,
        },
    },
    semverStyle: {
        patch: {
            groupTitle: '### Patch Changes',
        },
        minor: {
            groupTitle: '### Minor Changes',
            order: -1,
        },
        major: {
            groupTitle: '## Major Changes',
            order: -2,
        },
    },
}

export const generateChangelog = (
    messagesByRule: NextVersionReturn['commitsByRule'],
    style: Config['changelog']['style'],
    metadata: { bumpType: string },
): string => {
    if (messagesByRule.rawOverride) return messagesByRule.rawOverride as string
    const rules = notesRules[style]!
    // unsafe
    const headings = [] as Array<{ order: number; markdown: string }>
    for (const [noteRule, messages] of Object.entries(messagesByRule)) {
        let markdown = ''
        const rule = rules[noteRule]!
        markdown += `${rule.groupTitle}\n\n`
        markdown += (messages as string[]).map(msg => `- ${msg}`).join('\n')
        headings.push({
            markdown,
            order: rule.order ?? 0,
        })
    }

    let markdown = sortBy(headings, ({ order }) => order)
        .map(({ markdown }) => markdown)
        .join('\n')
    // TODO! include more metadata
    // TODO describe metadata in Readme. this will allow github-extra to filter out releases by type (e.g. whether they have new features or not)
    markdown = `<!-- bump-type:${metadata.bumpType} -->\n${markdown}`
    return markdown
}
