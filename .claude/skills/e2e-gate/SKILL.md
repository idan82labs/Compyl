---
name: e2e-gate
description: Run the appropriate Playwright slice and summarize browser truth before a task cluster closes.
disable-model-invocation: true
allowed-tools: Read, Bash, Grep, Glob
---

For $ARGUMENTS:

1. Identify the affected flows from `validation/e2e-matrix.md`
2. Run the smallest sufficient Playwright subset first
3. If failures appear, inspect traces and summarize root cause
4. Update the relevant validation docs with evidence
5. Recommend merge / no-merge status
