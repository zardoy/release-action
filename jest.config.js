/** @type{import('@jest/types').Config.InitialOptions} */
const config = {
    testPathIgnorePatterns: ['fixtures'],
    transform: {
        '^.+\\.tsx?$': 'esbuild-runner/jest',
    },
}

module.exports = config
