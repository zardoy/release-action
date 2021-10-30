This document describes the analyzing and extracting from the commit history.

Example from `modify-package-json` repo:

Commit:

```txt
feat: Rename `ifFieldIsMissingForSetter` to `ifPropertyIsMissingForSetter` and `ifFieldIsMissing` to `ifPropertyIsMissing`

Note: Old properties are preserved and deprecated for compatibility.
```

In generated changelog (release or markdown file):

```md
## Features

- Rename `ifFieldIsMissingForSetter` to `ifPropertyIsMissingForSetter` and `ifFieldIsMissing` to `ifPropertyIsMissing`

> Note: Old properties are preserved and deprecated for compatibility.
```

But you don't really need to write this additional message about deprecation, as absence of `BREAKING` implies it.

## Several Bumps in one Commit

Commits can have multiple lines, starting with conventional format:

```txt
fix: This rare bug has finally fixed closes #33343

Some background for bug goes here...
feat: Add new feature within commit
Description
```

```md
## Bug Fixes

- This rare bug has finally fixed closes ([#33343](link-to-issue))

## Features

- Rename `ifFieldIsMissingForSetter` to `ifPropertyIsMissingForSetter` and `ifFieldIsMissing` to `ifPropertyIsMissing`

Description
```

Though, this is highly not recommended and should be used in some special circumstances.

If the bug was fixed by introducing a new feature, only `feat` must be used.

The one thing was omited in these examples: is change was not contributes by pr (not ends with `(#21)`), link to commit will be placed. You can configure behavior if the next note refers to the same commit (as in example above):

- `skip` - (default) don't add link
- `add` - add the same link

## Conventional Format

Regex to check: `(\S+\s?)?\S+:`

Possible formats are:

`[publish] feat: add...`
`WIP feat(BUTTON): add...`

If body line starts with conventional format, new note will be created, if it doesn't pass note check, it will be ignored e.g.:

```txt
fix: This rare bug has finally fixed closes #33343

Some background for bug goes here...
test: Fix tests
Tests were hard to fix
```

`test: Fix tests` and below will be striped from feature note.
