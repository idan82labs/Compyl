/**
 * Figma client interface and stub implementation.
 *
 * Defines the abstract interface for Figma API access. The stub
 * implementation returns fixture data for testing. A real implementation
 * would use Figma's REST API with OAuth tokens stored in integrationCredentials.
 *
 * Auth model:
 * - Per-project Figma token stored in integrationCredentials (AES-256-GCM encrypted)
 * - figmaFileId on projects table identifies the connected Figma file
 * - Token refresh handled transparently by the client
 */

import type { FigmaComponentInfo, CodeConnectMapping } from "@compyl/contracts";

// =============================================================================
// Configuration
// =============================================================================

export interface FigmaConfig {
  /** Figma file ID from the project. */
  fileId: string;
  /** Decrypted access token. */
  accessToken: string;
  /** Optional Code Connect mappings for this project. */
  codeConnectMappings?: CodeConnectMapping[];
}

// =============================================================================
// Client interface
// =============================================================================

/**
 * Abstract Figma client. Implementations fetch component data from Figma's API.
 * The ranking service depends on this interface, never on Figma API details.
 */
export interface FigmaClient {
  /**
   * Get all components in the connected Figma file.
   * Returns component metadata used for candidate matching.
   */
  getFileComponents(fileId: string): Promise<FigmaComponentInfo[]>;

  /**
   * Get Code Connect mappings for this project.
   * Returns empty array if Code Connect is not configured.
   */
  getCodeConnectMappings(fileId: string): Promise<CodeConnectMapping[]>;
}

// =============================================================================
// Stub implementation (for testing and development)
// =============================================================================

/**
 * Stub Figma client that returns configurable fixture data.
 * Used in tests and when no real Figma token is available.
 */
export class StubFigmaClient implements FigmaClient {
  private components: FigmaComponentInfo[];
  private mappings: CodeConnectMapping[];

  constructor(
    components: FigmaComponentInfo[] = [],
    mappings: CodeConnectMapping[] = [],
  ) {
    this.components = components;
    this.mappings = mappings;
  }

  async getFileComponents(_fileId: string): Promise<FigmaComponentInfo[]> {
    return this.components;
  }

  async getCodeConnectMappings(_fileId: string): Promise<CodeConnectMapping[]> {
    return this.mappings;
  }
}
