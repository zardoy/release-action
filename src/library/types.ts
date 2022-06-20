export type OctokitRepo = Record<'owner' | 'repo', string>
export type OctokitRepoWithUrl = OctokitRepo & { url: string }
