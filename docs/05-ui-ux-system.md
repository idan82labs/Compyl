# 05 — UI/UX System and Consistency Rules

## UX split

ReviewLayer has two product languages:

1. **Reporter language**: semantic, plain, reassuring, non-technical
2. **Developer language**: explicit, structured, provenance-aware, system-oriented

Never blur them.

## Shared UI rules

- Same spacing scale across dashboard, review, triage, and settings
- Same badge/status vocabulary across cards, lists, filters, and activity logs
- Same empty/loading/error-state patterns across all tabs
- Same keyboard interaction patterns for drawers, panels, modals, and inspector panes
- No page should invent its own table density or filter layout

## Reporter UX rules

- Default action is always obvious
- Jargon is banned
- Clarification prompts must stay concrete and human-readable
- Attachments and annotation tools must be visually forgiving
- Save state must be obvious

## Developer UX rules

- Exact Source and Ancestry are separate blocks
- Confidence and missing reasons are always visible when relevant
- The curation gate is explicit and reversible
- Design diff must separate “deviation” from “responsive adaptation”
- Agent activity is auditable, not mystical

## Page consistency checks

All pages should be reviewed against:

- spacing and typography parity
- toolbar consistency
- form controls and validation consistency
- right-sidebar / inspector consistency
- loading / empty / permission-denied states

## Must-have UI artifacts before scale-up

- shared design tokens
- component library stories
- page-level screenshot baselines for review, summary, triage, settings
- accessibility pass for keyboard nav and focus states
