# Issue Management

Automatically manage issue comments. This action:

- Add a `needs-triage` label when an issue is opened
- Adds a `waiting-for-author` label when a team member has responded
- Adds a `waiting-for-team` label when the author has responded
- Adds a `closed-by-team` label when the issue is closed by a team member
- Adds a `closed-by-author` label when the issue is closed by the issue author

These labels can then be used to build up a search to see which issues need your attention, or to report on closed issues using the API in the future

## Usage

```yaml
name: Issue Management
on:
  issues:
    types: [opened, closed, reopened]
  issue_comment:
    types: [created]

jobs:
  issue-management:
    name: Issue Management
    runs-on: ubuntu-latest
    steps:
      - name: Issue Management
        uses: mheap/github-action-issue-management@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Available Configuration

### Environment Variables

| Name           | Description                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | The GitHub auth token, used to authenticate API requests. Use the value provided in `${{ secrets.GITHUB_TOKEN }}` |
