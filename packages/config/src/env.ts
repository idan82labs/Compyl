/**
 * Environment variable validation.
 *
 * All required env vars are validated at startup.
 * Missing required vars throw immediately — fail fast, not at first query.
 */

export interface Env {
  /** Neon PostgreSQL connection string. */
  DATABASE_URL: string;
  /** AI worker base URL. */
  WORKER_AI_URL: string;
  /** Auth.js secret for session signing. */
  AUTH_SECRET: string;
  /** Node environment. */
  NODE_ENV: "development" | "production" | "test";
  /** API server port. */
  PORT: string;
  /** API server host. */
  HOST: string;
}

interface EnvVarDef {
  required: boolean;
  default?: string;
}

const ENV_SCHEMA: Record<keyof Env, EnvVarDef> = {
  DATABASE_URL: { required: true },
  WORKER_AI_URL: { required: false, default: "http://localhost:8001" },
  AUTH_SECRET: { required: true },
  NODE_ENV: { required: false, default: "development" },
  PORT: { required: false, default: "3001" },
  HOST: { required: false, default: "0.0.0.0" },
};

/**
 * Validate all environment variables against the schema.
 * Throws on missing required vars. Returns validated Env object.
 */
export function validateEnv(): Env {
  const errors: string[] = [];
  const result: Record<string, string> = {};

  for (const [key, def] of Object.entries(ENV_SCHEMA)) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      result[key] = value;
    } else if (def.default !== undefined) {
      result[key] = def.default;
    } else if (def.required) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n  ${errors.join("\n  ")}`);
  }

  return result as unknown as Env;
}

/**
 * Get a validated Env, cached after first call.
 * For use in application code after startup.
 */
let _cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!_cachedEnv) {
    _cachedEnv = validateEnv();
  }
  return _cachedEnv;
}
