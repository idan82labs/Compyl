---
name: visual-critique-loop
description: Run the Playwright visual critique loop — screenshot all pages, score against rubric, produce fix list, repeat until all pages score 9/10 or 5 rounds complete.
context: fork
agent: visual-critique-agent
allowed-tools: Read, Bash, Glob, Grep
---

Run the visual critique loop for Compyl UI rebrand.

## Steps

1. Run: `cd tests/e2e && npx playwright test visual-critique.spec.ts --reporter=list`
2. Examine all screenshots in `tests/e2e/screenshots/`
3. Score each page against the 10-point rubric in your agent definition
4. Write critique to `validation/ui-rebrand.md`
5. If all pages >= 9/10 -> report SUCCESS, record final scores
6. If any page < 9/10 -> report the fix list to the lead

Maximum 5 rounds. If not converged by round 5, report current scores and remaining fixes as backlog.
