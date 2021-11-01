# Publish Action

I temporary use it instead of `semantic-release`.

This action:

- ignores branch check, you can specify it in your workflow
- uses GitHub API to fetch latest tag, instead of pulling full git history

Warning! Highly opinionated. `bin` entrypoint is intended to be run in GitHub action environment.

- Works only with GitHub
- Works best with tsc
- Presets were configured for my workflow and minimal setup

Yet another automatic release solution & changelog generator that is intended to work only with GitHub and have clean & configurable base, without unneeded layers of abstraction.

## Special Flags

> There are both unimplemented.

- `[go-stable]` Bumps version to v1.0.0. Useful on `unstableSemver` strategy (default). If version is already 1.0.0 or higher, does nothing.
TODO: allow without message
- `[publish]` (Only if enabled in config). Publish only from latest tag to commit that starts with this flag.

> But its not possible to combine them or with them. e.g. this would fail: `WIP [publish]`

# Why not `semantic-release`

- seamless integration with existing packages e.g. would fetch latest version from npm instead of starting with `v1.0.0` of no tags found
<!-- TODO in case of failure  -->
- starts `v0.0.1` instead of making your package stable by default and remains to hold your package unstable (bumps minor only on BREAKING), until you mark as stable by special flag (see above)
- runs test / linter / build for you only `test` and `build` scripts must be present. Linter script would be opinionated

## TODO

- prerelease
- contribution channels
- support `!` as BREAKING
