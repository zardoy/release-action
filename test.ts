import { Octokit } from '@octokit/rest'

const octokit = new Octokit()

const { data } = await octokit.repos.listCommits({
    owner: 'mui-org',
    repo: 'material-ui',
    sha: '58f8ff1f8bc7f0cc4bb728654604a194b3c3790b',
})

console.log(data.map(({ commit }) => commit.message))
