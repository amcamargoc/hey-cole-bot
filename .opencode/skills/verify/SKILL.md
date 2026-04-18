---
name: verify
description: Verify implementation output against plan acceptance criteria. Catches errors early. Use after completing a phase or task to validate before moving on.
---

# Verify

After completing a phase or task, verify the output before moving on. Do not skip this step.

## Process

### 1. Load the plan

Read the plan file from `./plans/` (or the PRD if no plan exists). Identify the acceptance criteria for the current phase.

### 2. Check each criterion

For every acceptance criterion, verify:

- [ ] Does the implementation satisfy this criterion?
- [ ] Can you demonstrate it works? (run tests, check output, read the code)
- [ ] Are there regressions in previously completed phases?

### 3. Report results

Output a checklist:

```
## Verification: Phase N

- [x] Criterion 1 — PASS
- [ ] Criterion 2 — FAIL: [brief reason]
- [x] Criterion 3 — PASS

Result: PASS / FAIL
```

### 4. Act on results

- **All PASS**: Proceed to next phase. Commit working state.
- **Any FAIL**: Fix the failing criteria before moving on. Do not start the next phase with known failures.

## Why this matters

Errors caught at $0.01 in this phase cost $1.00 to fix two phases later. Verify early, verify often.
