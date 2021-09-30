// not used, was used for testing with semantic-release

module.exports = {
    branches: ['master', 'main'],
    plugins: [
        //
        [
            '@semantic-release/commit-analyzer',
            {
                releaseRules: [
                    { type: 'docs', scope: 'README', release: 'patch' },
                    // I'm not sure, shouldn't be used
                    { type: 'docs', scope: 'NPM', release: 'patch' },
                    // These also shouldn't be used
                    { type: 'release', scope: 'patch', release: 'patch' },
                    { type: 'release', scope: 'minor', release: 'patch' },
                ],
            },
        ],
        '@semantic-release/release-notes-generator',
        '@semantic-release/npm',
        '@semantic-release/github',
    ],
}
