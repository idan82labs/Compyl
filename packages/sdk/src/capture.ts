/**
 * Element capture utilities.
 *
 * Extracts reporter-level annotation data from a clicked DOM element.
 * This is the SDK's click-time capture layer.
 *
 * What this captures:
 * - DOM selector (for element identification)
 * - Element bounding box (for visual positioning)
 * - Computed styles (for design diff — stored but not exposed to reporter)
 * - data-rl-source (for exact_source resolution by the backend)
 * - Viewport state
 *
 * What this does NOT do:
 * - Fiber walk (that's react-adapter's job)
 * - Resolve component stack (that's react-adapter's job)
 * - Build ancestry (runtime, not capture-time)
 */

import type { AnnotationPayload, ViewportState, ElementBbox } from "./types.js";

// =============================================================================
// Element capture
// =============================================================================

/** Styles captured for design diff computation. */
const CAPTURED_STYLE_PROPERTIES = [
  "color",
  "backgroundColor",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "padding",
  "margin",
  "borderRadius",
  "border",
  "boxShadow",
  "opacity",
  "display",
  "position",
  "width",
  "height",
] as const;

/**
 * Capture annotation data from a clicked element.
 *
 * This is called at click time — "cost on click, not on render."
 * Returns a partial AnnotationPayload that the SDK merges with
 * reporter input (raw_text, screenshots, etc.) before submission.
 */
export function captureElementData(element: Element): Partial<AnnotationPayload> {
  return {
    type: "element_select",
    page_url: window.location.href,
    viewport: captureViewport(),
    dom_selector: generateSelector(element),
    element_bbox: captureBbox(element),
    computed_styles: captureStyles(element),
    data_rl_source: readDataRlSource(element),
  };
}

// =============================================================================
// data-rl-source capture
// =============================================================================

/**
 * Read the data-rl-source attribute from the clicked element.
 *
 * Walks UP the DOM tree to find the nearest element with data-rl-source.
 * This is because the build plugin attaches the attribute to host DOM
 * elements at their render site — the clicked element might be a child
 * of the annotated element.
 *
 * Returns undefined if no data-rl-source is found (graceful degradation).
 */
export function readDataRlSource(element: Element): string | undefined {
  let current: Element | null = element;

  while (current) {
    const source = current.getAttribute("data-rl-source");
    if (source) return source;
    current = current.parentElement;
  }

  return undefined;
}

// =============================================================================
// Viewport capture
// =============================================================================

export function captureViewport(): ViewportState {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scroll_x: window.scrollX,
    scroll_y: window.scrollY,
  };
}

// =============================================================================
// Bounding box capture
// =============================================================================

export function captureBbox(element: Element): ElementBbox {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

// =============================================================================
// Style capture
// =============================================================================

/**
 * Capture computed styles for design diff computation.
 * Only captures a fixed set of design-relevant properties.
 */
export function captureStyles(element: Element): Record<string, string> {
  const computed = window.getComputedStyle(element);
  const styles: Record<string, string> = {};

  for (const prop of CAPTURED_STYLE_PROPERTIES) {
    styles[prop] = computed.getPropertyValue(prop);
  }

  return styles;
}

// =============================================================================
// Selector generation
// =============================================================================

/**
 * Generate a unique CSS selector for the element.
 * Uses ID > data-testid > nth-child path strategy.
 */
export function generateSelector(element: Element): string {
  // 1. ID (most reliable)
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // 2. data-testid (common in React apps)
  const testId = element.getAttribute("data-testid");
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // 3. Build path from root using tag + nth-child
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const el: Element = current;
    const tag = el.tagName.toLowerCase();

    if (el.id) {
      parts.unshift(`#${CSS.escape(el.id)}`);
      break;
    }

    const parent: Element | null = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s: Element) => s.tagName === el.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        parts.unshift(tag);
      }
    } else {
      parts.unshift(tag);
    }

    current = parent;
  }

  return parts.join(" > ");
}
