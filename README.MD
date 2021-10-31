# Publish Action

I temporary use it instead of `semantic-release`.

This action:

- ignores branch check, you can specify it in your workflow
- uses GitHub API to fetch latest tag, instead of pulling full git history

Warning! I didn't make it available to public usage, because it's highly opinionated.

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

## TODO

- prerelease
- contribution channels
