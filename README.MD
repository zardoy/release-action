# Publish Action

> Yet another automatic release solution & changelog generator that is intended to work only with GitHub and have clean & configurable base, without unneeded layers of abstraction.

For now, I use it instead of `semantic-release`.This is some kind of rewritten version of `semantic-release`, more verbose config, better defaults and more deep integration with GitHub.

Highlights:

- Works only with GitHub
- uses GitHub API to fetch last tag and history of commits, instead of pulling full git history
- Builtin presets for publishing to NPM and VSCode Marketplace
- best possible TypeScript typing for the config

- Better steps order:
    - get next version after analyzing commits
    - run `build` and `test` (even if no version bump)
    - if no version bump, exit
    - package and publish
    - new GitHub release and tag

But, the main difference is there is no real steps and plugins that define them. Presets do whatever they want in one step (package and publish).

Warning! Highly opinionated. `bin` entrypoint is intended to be run on main branch of GitHub action environment.

## Special Flags

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
