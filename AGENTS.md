# Repository instructions

## Read first

- Read the [contributor guide](docs/project-testing.md) for development and validation.
- Read the [API reference](docs/API.md) before changing a public contract.

## Shared workflow

In the shared Projects workspace, use `Instructions/library-review.md` for library reviews and `Instructions/library-release.md` for release preparation. Follow the applicable engineering and agent task execution standards in `Libs/engineering-playbook`.

Start each commit subject with a capitalised imperative verb, such as `Update API examples`.

## Validation

Preserve unrelated changes and existing public contracts. Use the relevant checks in [package.json](package.json) and add focused regression coverage for behaviour changes. Report the checks run and any gaps.
