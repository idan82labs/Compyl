# Validation — Runtime Stack Resolution

## Scenarios

- [ ] plain client component
- [ ] memo / forwardRef wrapper
- [ ] HOC wrapper
- [ ] portal within same root
- [ ] fragment / renderless wrapper
- [ ] suspense fallback committed
- [ ] lazy child after resolve
- [ ] error boundary fallback
- [ ] separate React root boundary
- [ ] server/client boundary fallback
- [ ] hydration-before-complete behavior
- [ ] uninstrumented third-party leaf

## Assertions

- [ ] `exact_source` is populated when leaf provenance is available
- [ ] `resolved_component_stack` is ordered and deduped
- [ ] `resolution_mode` is correct
- [ ] `line_kind` distinguishes exact leaf vs definition lines
- [ ] `missing_reasons` are present when stack is partial
- [ ] UI separates Exact Source from Ancestry

## Evidence

- fixture app path:
- test file:
- known unsupported cases:
