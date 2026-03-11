/**
 * Kill switch tests.
 */

import { createKillSwitch } from "../kill-switch.js";

function testKillSwitchBasics(): void {
  const ks = createKillSwitch({ threshold: 0.10, windowMs: 60_000 });

  // Not tripped initially
  if (ks.isTripped()) throw new Error("Should not be tripped initially");
  if (ks.getFailureRate() !== 0) throw new Error("Rate should be 0 initially");

  // Below minimum sample (5)
  ks.recordAttempt(false);
  ks.recordAttempt(false);
  if (ks.isTripped()) throw new Error("Should not trip below minimum sample");

  console.log("PASS: Kill switch basics");
}

function testKillSwitchTrips(): void {
  const ks = createKillSwitch({ threshold: 0.10, windowMs: 60_000 });

  // 10 attempts, 2 failures = 20% > 10% threshold
  for (let i = 0; i < 8; i++) ks.recordAttempt(true);
  for (let i = 0; i < 2; i++) ks.recordAttempt(false);

  if (!ks.isTripped()) throw new Error("Should be tripped at 20% failure rate");

  const rate = ks.getFailureRate();
  if (Math.abs(rate - 0.2) > 0.001) throw new Error(`Rate should be 0.2, got ${rate}`);

  console.log("PASS: Kill switch trips at threshold");
}

function testKillSwitchReset(): void {
  const ks = createKillSwitch({ threshold: 0.10, windowMs: 60_000 });

  for (let i = 0; i < 10; i++) ks.recordAttempt(false);
  if (!ks.isTripped()) throw new Error("Should be tripped");

  ks.reset();
  if (ks.isTripped()) throw new Error("Should not be tripped after reset");
  if (ks.getFailureRate() !== 0) throw new Error("Rate should be 0 after reset");

  console.log("PASS: Kill switch reset");
}

function testKillSwitchStaysHealthy(): void {
  const ks = createKillSwitch({ threshold: 0.10, windowMs: 60_000 });

  // 100 attempts, 5 failures = 5% < 10% threshold
  for (let i = 0; i < 95; i++) ks.recordAttempt(true);
  for (let i = 0; i < 5; i++) ks.recordAttempt(false);

  if (ks.isTripped()) throw new Error("Should NOT be tripped at 5% failure rate");

  console.log("PASS: Kill switch stays healthy below threshold");
}

testKillSwitchBasics();
testKillSwitchTrips();
testKillSwitchReset();
testKillSwitchStaysHealthy();
console.log("\nAll kill switch tests passed.");
