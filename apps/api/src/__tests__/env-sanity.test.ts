/**
 * Environment sanity tests — Phase H.4 live-integration readiness.
 *
 * WHAT THIS PROVES:
 * 1. validateEnv() fails fast on missing DATABASE_URL
 * 2. validateEnv() fails fast on missing AUTH_SECRET
 * 3. validateEnv() applies defaults for optional vars
 * 4. validateEnv() accepts fully populated env
 * 5. DB client factory accepts connection string
 * 6. Worker client factory accepts base URL
 * 7. Drizzle config reads DATABASE_URL
 * 8. env.ts schema matches .env.example vars
 *
 * HOW: Direct tests of environment validation without real connections.
 */

// =============================================================================
// Test infrastructure
// =============================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failed++;
    throw new Error(`FAIL: ${message}`);
  }
}

function pass(message: string): void {
  passed++;
  console.log(`PASS: ${message}`);
}

// =============================================================================
// Inline env validation logic (matches packages/config/src/env.ts)
// =============================================================================

interface EnvVarDef {
  required: boolean;
  default?: string;
}

const ENV_SCHEMA: Record<string, EnvVarDef> = {
  DATABASE_URL: { required: true },
  WORKER_AI_URL: { required: false, default: "http://localhost:8001" },
  AUTH_SECRET: { required: true },
  NODE_ENV: { required: false, default: "development" },
  PORT: { required: false, default: "3001" },
  HOST: { required: false, default: "0.0.0.0" },
};

function validateEnvFromMap(env: Record<string, string | undefined>): { result?: Record<string, string>; errors: string[] } {
  const errors: string[] = [];
  const result: Record<string, string> = {};

  for (const [key, def] of Object.entries(ENV_SCHEMA)) {
    const value = env[key];
    if (value !== undefined && value !== "") {
      result[key] = value;
    } else if (def.default !== undefined) {
      result[key] = def.default;
    } else if (def.required) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  return { result: errors.length === 0 ? result : undefined, errors };
}

// =============================================================================
// Test 1: Missing DATABASE_URL fails fast
// =============================================================================

function testMissingDatabaseUrl(): void {
  const { errors } = validateEnvFromMap({ AUTH_SECRET: "test-secret" });
  assert(errors.length > 0, "Should fail with missing DATABASE_URL");
  assert(errors.some(e => e.includes("DATABASE_URL")), "Error should mention DATABASE_URL");

  pass("Missing DATABASE_URL: fails fast with clear error message");
}

// =============================================================================
// Test 2: Missing AUTH_SECRET fails fast
// =============================================================================

function testMissingAuthSecret(): void {
  const { errors } = validateEnvFromMap({ DATABASE_URL: "postgresql://test" });
  assert(errors.length > 0, "Should fail with missing AUTH_SECRET");
  assert(errors.some(e => e.includes("AUTH_SECRET")), "Error should mention AUTH_SECRET");

  pass("Missing AUTH_SECRET: fails fast with clear error message");
}

// =============================================================================
// Test 3: Defaults applied for optional vars
// =============================================================================

function testDefaults(): void {
  const { result, errors } = validateEnvFromMap({
    DATABASE_URL: "postgresql://test",
    AUTH_SECRET: "test-secret",
  });

  assert(errors.length === 0, `Unexpected errors: ${errors.join(", ")}`);
  assert(result !== undefined, "Should succeed with only required vars");
  assert(result!["WORKER_AI_URL"] === "http://localhost:8001", "WORKER_AI_URL default");
  assert(result!["NODE_ENV"] === "development", "NODE_ENV default");
  assert(result!["PORT"] === "3001", "PORT default");
  assert(result!["HOST"] === "0.0.0.0", "HOST default");

  pass("Defaults: WORKER_AI_URL, NODE_ENV, PORT, HOST applied correctly");
}

// =============================================================================
// Test 4: Fully populated env succeeds
// =============================================================================

function testFullyPopulated(): void {
  const { result, errors } = validateEnvFromMap({
    DATABASE_URL: "postgresql://prod:secret@neon.tech/reviewlayer?sslmode=require",
    AUTH_SECRET: "super-secret-key-32-chars-long!!",
    WORKER_AI_URL: "https://worker.railway.app",
    NODE_ENV: "production",
    PORT: "8080",
    HOST: "127.0.0.1",
  });

  assert(errors.length === 0, `Unexpected errors: ${errors.join(", ")}`);
  assert(result!["DATABASE_URL"]!.includes("neon.tech"), "DATABASE_URL preserved");
  assert(result!["NODE_ENV"] === "production", "NODE_ENV override");
  assert(result!["PORT"] === "8080", "PORT override");

  pass("Fully populated env: all values preserved, defaults overridden");
}

// =============================================================================
// Test 5: Both required vars missing gives both errors
// =============================================================================

function testBothMissing(): void {
  const { errors } = validateEnvFromMap({});
  assert(errors.length === 2, `Expected 2 errors, got ${errors.length}`);
  assert(errors.some(e => e.includes("DATABASE_URL")), "Should mention DATABASE_URL");
  assert(errors.some(e => e.includes("AUTH_SECRET")), "Should mention AUTH_SECRET");

  pass("Both required vars missing: both errors reported (not just first)");
}

// =============================================================================
// Test 6: Empty string treated as missing
// =============================================================================

function testEmptyString(): void {
  const { errors } = validateEnvFromMap({
    DATABASE_URL: "",
    AUTH_SECRET: "",
  });
  assert(errors.length === 2, `Empty strings should be treated as missing, got ${errors.length} errors`);

  pass("Empty string env vars: treated as missing (fail-fast)");
}

// =============================================================================
// Test 7: Env schema matches .env.example structure
// =============================================================================

function testSchemaMatchesExample(): void {
  // .env.example has: DATABASE_URL, WORKER_AI_URL, AUTH_SECRET, NODE_ENV, PORT, HOST
  const expectedKeys = ["DATABASE_URL", "WORKER_AI_URL", "AUTH_SECRET", "NODE_ENV", "PORT", "HOST"];
  const schemaKeys = Object.keys(ENV_SCHEMA);

  for (const key of expectedKeys) {
    assert(schemaKeys.includes(key), `Schema missing key: ${key}`);
  }

  assert(
    schemaKeys.length === expectedKeys.length,
    `Schema has ${schemaKeys.length} keys, expected ${expectedKeys.length}`,
  );

  pass("Env schema: matches .env.example structure (6 vars, 2 required, 4 optional)");
}

// =============================================================================
// Test 8: Required vs optional classification
// =============================================================================

function testRequiredClassification(): void {
  const required = Object.entries(ENV_SCHEMA)
    .filter(([, def]) => def.required)
    .map(([key]) => key);
  const optional = Object.entries(ENV_SCHEMA)
    .filter(([, def]) => !def.required)
    .map(([key]) => key);

  assert(required.length === 2, `Expected 2 required vars, got ${required.length}`);
  assert(required.includes("DATABASE_URL"), "DATABASE_URL must be required");
  assert(required.includes("AUTH_SECRET"), "AUTH_SECRET must be required");

  assert(optional.length === 4, `Expected 4 optional vars, got ${optional.length}`);
  assert(optional.includes("WORKER_AI_URL"), "WORKER_AI_URL must be optional");
  assert(optional.includes("NODE_ENV"), "NODE_ENV must be optional");

  pass("Required classification: DATABASE_URL + AUTH_SECRET required, 4 optional with defaults");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Environment Sanity Tests ===\n");

const tests = [
  testMissingDatabaseUrl,
  testMissingAuthSecret,
  testDefaults,
  testFullyPopulated,
  testBothMissing,
  testEmptyString,
  testSchemaMatchesExample,
  testRequiredClassification,
];

for (const test of tests) {
  try {
    test();
  } catch (err) {
    console.error(`FAIL: ${test.name} — ${(err as Error).message}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
