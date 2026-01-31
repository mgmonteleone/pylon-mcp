---
description: Review pull requests for code quality and correctness
argument-hint: [PR number or "watch"]
---

Use the `sub-agent-pr-review-boss` tool to dispatch a PR Review Boss agent with the following request:

$ARGUMENTS

If the ARGUMENTS are empty, then the agent should watch for new PRs and review them.
If the ARGUMENTS contains "watch" then the agent should watch for new PRs and review them, if the there is also timing information in the ARGUMENTS, then the agent should use that to determine how often to check
for new PRs, and for how long, otherwise it should default to checking every 2 minutes for two hours.
If the ARGUMENTS contains a number, then the agent should review that PR.
