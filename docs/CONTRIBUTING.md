# Contributing to Headplane

Thank you for your interest in contributing to Headplane. I maintain this
project entirely on my own so any help is greatly appreciated. Since I am the
sole maintainer, I have a few guidelines which help make it significantly easier
for me to review and merge your contributions.

## Contribution Types
- **Bug Reports/Feature Requests**: If you find a bug, please open an
[issue](https://github.com/tale/headplane/issues) using one of the predefined
templates. Issues are only for bug reports and feature requests, not problems
that you encounter from misconfiguration or usage. Those belong in the
[discussions](https://github.com/tale/headplane/discussions) section.

- **Documentation/Examples**: If you find any issues in the documentation or
would like to contribute examples for setting up Headplane, please open a PR
and I will review it and possibly make changes.

- **Code Contributions**: Code contributions are done via PRs but *must* be
linked to an issue or a feature request (you can make one if it doesn't exist).
Please tag them with the appropriate labels when opening an issue or PR.

### Code Contribution Restrictions
- **No Large Refactors**: I am not interested in large refactors of the codebase
because I've already had do to this a lot and it becomes a headache to review,
maintain, and merge. This also means you should split up multiple contributions
into multiple PRs if they are unrelated to each other.

- **No Project/Tooling Changes**: Unless there is a very good reason to do so,
I will not accept changes to the project structure, build system, or tooling
used to develop Headplane. This includes things like changing the package
manager, docker environment, or CI/CD.

- **Minimal Breaking Changes**: I will not accept any changes that break any
existing functionality or change the API unless there is a very good reason
to do so. If you want to make a breaking change, please open an issue first
and discuss it with me.

### Code Style
This is very easy and self-explanatory. [Biome](https://biomejs.dev) is used as
a linter and formatter for the TypeScript, while Go's default formatting and
lint tooling are used within `agent/` code. I've setup a git hook to run
before commit to make these changes automatically.

> All of these guidelines are fairly simple to follow and are flexible if needed.
> I won't automatically close PRs or issues if they don't follow these rules,
> but instead we can discuss them and see if we can come to a compromise.
