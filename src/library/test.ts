import { Octokit } from '@octokit/rest'

const octokit = new Octokit()

octokit.users.getByUsername({ username: 'zardoy' }).then(({ data }) => {
    console.log(data)
})
