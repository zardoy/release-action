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

## TODO

- prerelease
- contribution channels
