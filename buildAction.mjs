import { build } from 'esbuild'

await build({
    bundle: true,
    platform: 'node',
    minify: true,
    entryPoints: ['src/github-action/index.ts'],
    outfile: 'build-action/index.js',
})
