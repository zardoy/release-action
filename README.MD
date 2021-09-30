# Publish Action

I temporary removed `semantic-release` because of plenty of problems.

This action:

- ignores branch check, you can specify it in your workflow
- uses GitHub API to fetch latest tag, instead of pulling full git history

Warning! I didn't make it available to public usage, because it's highly opinionated.

- Works only with GitHub
- Works best with tsc

## TODO:

- prerelease
- contribution channels
