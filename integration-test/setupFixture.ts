import fs from 'fs'
import gitly from 'gitly'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import fsExtra from 'fs-extra'

export const getFixtureSetuper = (fixtureName: string, repo: `${string}/${string}#${string}`) => {
    const fixtureBasePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', fixtureName)
    const fixtureOut = join(fixtureBasePath, 'out')
    return {
        fixturePath: fixtureOut,
        async setupFixture() {
            const fixtureSrc = join(fixtureBasePath, 'src')
            if (!fs.existsSync(fixtureSrc)) {
                await gitly(repo, fixtureSrc, {})
            }
            if (fs.existsSync(fixtureOut)) await fs.promises.rm(fixtureOut, { recursive: true })
            await fsExtra.copy(fixtureSrc, fixtureOut)
            process.chdir(fixtureOut)
            process.env.CI = '1'
            process.env.GITHUB_TOKEN = 'foo'
            process.env.GITHUB_REPOSITORY = 'author/sample-repo'
        },
    }
}
