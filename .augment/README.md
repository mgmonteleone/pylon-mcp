# Using Augment Agents in This Repository

This repository includes custom Augment agents and slash commands tailored for DevRev Airdrop snap-in development with Pylon integration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Checkout A (Feature Work)          Checkout B (PR Review)     │
│   ┌─────────────────────┐           ┌─────────────────────┐     │
│   │      FOREMAN        │           │   PR REVIEW BOSS    │     │
│   │   (Orchestrator)    │──────────▶│   (Watches PRs)     │     │
│   └─────────┬───────────┘   Creates └─────────────────────┘     │
│             │                  PR                                │
│             │ Calls                                              │
│             ▼                                                    │
│   ┌─────────────────────┐                                       │
│   │    Sub-Agents       │                                       │
│   │  ┌───────────────┐  │                                       │
│   │  │ Builder       │  │                                       │
│   │  │ Tester        │  │                                       │
│   │  │ Bug Fixer     │  │                                       │
│   │  │ Simplifier    │  │                                       │
│   │  │ Documentation │  │                                       │
│   │  └───────────────┘  │                                       │
│   └─────────────────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Custom Slash Commands

Commands are defined in `.augment/commands/` and use the [Augment CLI custom command format](https://docs.augmentcode.com/cli/custom-commands-examples).

### Available Commands

| Command           | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `/foreman`        | Orchestrate complete feature development from GitHub issue to PR |
| `/pr-review-boss` | Review pull requests for code quality and correctness            |
| `/devrev-expert`  | Get DevRev Airdrop and Pylon integration expert help             |

## Primary Workflow: Foreman-Driven Development

The **Foreman** is the primary orchestrator. You give it a feature request or task, and it:

1. Plans the implementation phases
2. Calls sub-agents as needed (Builder, Tester, etc.)
3. Creates commits and PRs
4. Coordinates the entire workflow

### Starting the Foreman

```
/foreman Implement extraction for Pylon tags with full test coverage
```

```
/foreman #15
```

The Foreman will automatically delegate to:

- **Builder** - For implementing components
- **Tester** - For writing tests
- **Documentation** - For adding docs
- **Simplifier** - For code cleanup
- **Bug Fixer** - If issues arise

## PR Review: Separate Checkout

The **PR Review Boss** should run on a **separate checkout** of the repository. It watches for PRs created by Foreman agents and performs code review.

### Setup for PR Review

```bash
# Clone a separate copy for PR review
git clone https://github.com/your-org/airdrop-pylon-snap-in.git airdrop-pylon-pr-review
cd airdrop-pylon-pr-review

# Start PR Review Boss watching for PRs
/pr-review-boss Watch for new PRs and review them
```

### Review a Specific PR

```
/pr-review-boss #8
```

## Running Multiple Foremen

You can run multiple Foreman agents in parallel, each working on different features. **Each Foreman must have its own local checkout.**

```bash
# Checkout 1: Feature A
git clone ... airdrop-pylon-feature-a
cd airdrop-pylon-feature-a
# /foreman Implement feature A

# Checkout 2: Feature B
git clone ... airdrop-pylon-feature-b
cd airdrop-pylon-feature-b
# /foreman Implement feature B

# Checkout 3: PR Review (watches both)
git clone ... airdrop-pylon-pr-review
cd airdrop-pylon-pr-review
# /pr-review-boss Watch and review PRs
```

## Available Agents

| Agent              | Role                                              | Called By                                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------------ |
| **Foreman**        | Orchestrates feature development                  | You (directly via `/foreman`)                    |
| **PR Review Boss** | Reviews PRs                                       | You (via `/pr-review-boss` on separate checkout) |
| **Builder**        | Implements components with DevRev/Pylon expertise | Foreman                                          |
| **Tester**         | Writes tests                                      | Foreman                                          |
| **Bug Fixer**      | Diagnoses and fixes bugs                          | Foreman                                          |
| **Simplifier**     | Refactors for clarity                             | Foreman                                          |
| **Documentation**  | Adds/updates docs                                 | Foreman                                          |

## Quick DevRev/Pylon Help

For quick questions about DevRev Airdrop or Pylon integration without running a full feature workflow:

```
/devrev-expert How do I handle pagination in extraction?
```

```
/devrev-expert What's the correct format for external_domain_metadata.json?
```

## Project Commands

```bash
cd code

npm run build          # Build TypeScript
npm test               # Run Jest tests
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run package        # Create deployment package

# Local test runner
npm run start -- --fixturePath=positive-case.json --functionName=extraction
```

## File Locations

| Path                 | Contents                             |
| -------------------- | ------------------------------------ |
| `.augment/agents/`   | Agent definitions (subagent configs) |
| `.augment/commands/` | Custom slash commands                |
| `.augment/rules/`    | Project-specific rules               |
| `CLAUDE.md`          | Base project instructions            |

## Command Format Reference

Custom commands use YAML frontmatter with `description` and `argument-hint`, followed by a prompt with `$ARGUMENTS`:

```markdown
---
description: Short description of the command
argument-hint: [expected arguments]
---

Your prompt here with $ARGUMENTS where user input goes.
```

See [Augment CLI Custom Commands Documentation](https://docs.augmentcode.com/cli/custom-commands) for more details.
