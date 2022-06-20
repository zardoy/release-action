import { readFile, writeFileSync } from 'fs'
import { extractChangelogFromGithub } from '../src/library/changelogFromGithub'

const markdown = await extractChangelogFromGithub({ owner: 'zardoy', repo: 'vscode-better-snippets', url: 'https://github.com/zardoy/vscode-better-snippets' })
writeFileSync('./changelog.md', 'utf8', markdown)
