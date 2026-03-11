# 08 — Runtime Stack Resolution (v8)

## The honest architecture

`data-rl-stack` is NOT a build-time DOM artifact. There is no such attribute.

The supported architecture is:

- build-time metadata on component types (`__rlMeta`)
- exact leaf provenance via `data-rl-source` → produces `exact_source`
- click-time ancestry resolution through a versioned React adapter → produces `resolved_component_stack`
- graceful degradation when ancestry cannot be fully recovered

## Naming discipline

- `exact_source`: single frame, build-time, from `data-rl-source`. Always `{ file_path, component_name, line, line_kind: "leaf-dom" }`.
- `resolved_component_stack`: array of frames, runtime, from fiber walk + `__rlMeta`. Each frame carries its own `line_kind` and provenance.
- These are NEVER combined into a single generic "component stack" or "source mapping" field.

## Build-time responsibilities

The plugin does only what is file-local and real:

- attach `__rlMeta = { id, name, file, line, isLibrary }` to instrumented component exports
- attach `data-rl-source` (or a compact source-id) to host DOM where exact leaf/render-site provenance is known
- strip markers in production builds by default

## Runtime responsibilities

The SDK does what only runtime can know:

- find nearest React host fiber for clicked DOM node
- walk `fiber.return`
- read metadata from wrapper-aware fields (`type`, `elementType`, `memo`, `forwardRef` targets)
- produce `resolved_component_stack`
- merge `exact_source` back in as the leaf frame
- mark provenance and gaps honestly

## Output contract (defined in packages/contracts)

- `exact_source`: `{ file_path, component_name, line, line_kind }` | null
- `resolved_component_stack`: `Array<{ component_name, file_path?, line?, line_kind, is_library, confidence? }>`
- `resolution_mode`: `fiber_meta` | `server_prefix` | `leaf_only` | `heuristic`
- `missing_reasons`: `string[]`
- `root_boundary_kind`: `portal` | `separate_root` | `rsc_client_boundary` | null

## Resolution modes

- `fiber_meta` — full fiber walk with `__rlMeta` available
- `server_prefix` — server-rendered prefix with limited ancestry
- `leaf_only` — only `exact_source` available, no ancestry recovered
- `heuristic` — DOM structure / class-based guessing (lowest confidence)

## Line kinds

- `leaf-dom` — exact DOM-emitting JSX site
- `definition` — component definition location (default for ancestor frames)
- `callsite` — exact parent callsite (deep mode only)

## Deep mode

Default mode gives:

- exact leaf line (`exact_source`)
- ancestor definition lines (`resolved_component_stack`)

Deep mode is opt-in and heavier. Use it only if exact ancestor callsite lines or better server-side ancestry are worth the complexity. Deep mode can use hidden prop / stack-id threading with a runtime registry.

## Failure modes to test explicitly

- portals
- fragments
- suspense + lazy
- error boundaries
- hydration windows
- pure server ancestors / client boundaries
- multiple roots
- third-party uninstrumented libraries
- HOCs / memo / forwardRef / render props
- React-version internal drift

## Observability requirements

Every click-time resolution must emit telemetry:

- `{ resolution_mode, frame_count, missing_reasons, exact_source_available, duration_ms }`
- Adapter failures emit: `{ react_version, failure_type, fallback_mode, fiber_depth_reached }`
- Kill switch triggers when adapter failure rate exceeds threshold (configurable, default 10% over 5-minute window)
- All telemetry flows to PostHog and is queryable in the diagnostics dashboard

## Product truth

In the UI and APIs, never imply that ancestry is always exact. `exact_source` is exact when present. `resolved_component_stack` is best-effort and confidence-scored.
