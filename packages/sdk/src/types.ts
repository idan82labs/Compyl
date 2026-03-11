/**
 * SDK types for annotation capture.
 *
 * These types represent what the SDK captures on the client side.
 * They are reporter-level payloads — NO provenance, NO file paths,
 * NO component ancestry. Those are resolved later by the backend
 * (react-adapter at click time, build-plugin at compile time).
 */

/** Annotation capture modes. */
export type AnnotationMode =
  | "element_select"
  | "freeform_draw"
  | "screenshot_region"
  | "full_page_note"
  | "reference_image";

/** Viewport state at annotation time. */
export interface ViewportState {
  width: number;
  height: number;
  scroll_x: number;
  scroll_y: number;
  device_preset?: string;
  css_breakpoint?: string;
}

/** Bounding box for element selection. */
export interface ElementBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Annotation payload — what the SDK sends to the API.
 *
 * This is strictly reporter-level data:
 * - What element/region was selected
 * - What the reporter said/drew
 * - Visual context (screenshot, viewport, bbox)
 *
 * NOT included (resolved later by backend):
 * - exact_source (build-time, from data-rl-source)
 * - resolved_component_stack (runtime, from fiber walk)
 * - resolution_mode, missing_reasons, root_boundary_kind
 * - severity, category, acceptance_criteria
 * - design_diff, design_candidates
 */
export interface AnnotationPayload {
  type: AnnotationMode;
  page_url: string;
  viewport: ViewportState;
  dom_selector?: string;
  element_bbox?: ElementBbox;
  computed_styles?: Record<string, string>;
  raw_text?: string;
  drawing_svg_url?: string;
  screenshot_url?: string;
  reference_images?: string[];

  /**
   * data-rl-source value from the selected element, if present.
   * Captured by the SDK but NOT exposed to the reporter —
   * forwarded to the API for exact_source resolution.
   */
  data_rl_source?: string;
}
