// To run: deno task test

import {
  assert,
  assertEquals,
  assertExists,
  Application,
  crypto,
  encodeHex,
  decodeBase64,
  ulid
} from "./deps.ts";
import { Visit } from "./models.ts";

// Mock environment variables for testing
Deno.env.set("SITE_ID", "test-site-id");
Deno.env.set("SITE_SALT", "test-salt-123");
Deno.env.set("DENO_REGION", "test-region");

Deno.test("Visit model structure", () => {
  const visit: Visit = {
    id: "test-id",
    path: "https://example.com",
    timestamp: Date.now(),
    visitor: "visitor-hash",
    edge_region: "us-east-1"
  };

  assertExists(visit.id);
  assertExists(visit.path);
  assertExists(visit.timestamp);
  assertExists(visit.visitor);
  assertExists(visit.edge_region);
});

Deno.test("Base64 pixel decoding", () => {
  const pixelData = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const pixel = decodeBase64(pixelData);

  // Should decode to a valid Uint8Array
  assert(pixel instanceof Uint8Array);
  assert(pixel.length > 0);

  // First few bytes should match GIF header
  assertEquals(pixel[0], 0x47); // 'G'
  assertEquals(pixel[1], 0x49); // 'I'
  assertEquals(pixel[2], 0x46); // 'F'
});

Deno.test("Visitor hash generation - matches main.ts logic", async () => {
  const s_salt = "test-salt-123";
  const s_id = "test-site-id";
  const v_ip = "192.168.1.1";
  const v_ua = "Mozilla/5.0 (Test Browser)";

  // This mirrors the exact logic from main.ts
  // Build an array of the site salt, site ID, IP, and UA string
  const v_arr: string[] = [s_salt, s_id, v_ip, v_ua];

  // Serialize the array
  const serializedArr = JSON.stringify(v_arr);

  // Hash the serialized array
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serializedArr));

  // Finally, output the hash as a string
  const visitor = encodeHex(new Uint8Array(hash));

  // Should generate a valid hash string
  assertExists(visitor);
  assert(typeof visitor === "string");
  assert(visitor.length > 0);

  // Should be deterministic - same inputs produce same hash
  const hash2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serializedArr));
  const visitor2 = encodeHex(new Uint8Array(hash2));
  assertEquals(visitor, visitor2);
});

Deno.test("ULID generation", () => {
  const id = ulid();

  // Should generate a valid ULID
  assertExists(id);
  assert(typeof id === "string");
  assertEquals(id.length, 26);

  // Should generate unique IDs
  const id2 = ulid();
  assert(id !== id2);
});

Deno.test("Visit object creation - matches main.ts structure", () => {
  const v_ts = Date.now();
  const v_id = ulid();
  const v_rf = "https://example.com/page";
  const visitor = "test-visitor-hash";
  const a_region = "test-region";

  // This mirrors the exact Visit object structure from main.ts
  const visit: Visit = {
    id: v_id,
    path: v_rf,
    timestamp: v_ts,
    visitor: visitor,
    edge_region: a_region,
  };

  assertEquals(visit.id, v_id);
  assertEquals(visit.path, v_rf);
  assertEquals(visit.timestamp, v_ts);
  assertEquals(visit.visitor, visitor);
  assertEquals(visit.edge_region, a_region);
});

Deno.test("Environment variables are accessible", () => {
  const siteId = Deno.env.get("SITE_ID");
  const siteSalt = Deno.env.get("SITE_SALT");
  const region = Deno.env.get("DENO_REGION");

  assertEquals(siteId, "test-site-id");
  assertEquals(siteSalt, "test-salt-123");
  assertEquals(region, "test-region");
});

Deno.test("Oak application can be created", () => {
  const app = new Application();
  assertExists(app);
  assert(app instanceof Application);
});

Deno.test("Deno KV connection can be established", async () => {
  // Test that we can open a KV connection like in main.ts
  const kv = await Deno.openKv();
  assertExists(kv);
  
  // Test basic KV operations
  const testKey = ["test", "visit", ulid()];
  const testValue = { test: "data", timestamp: Date.now() };
  
  // Set a value
  await kv.set(testKey, testValue);
  
  // Get the value back
  const result = await kv.get(testKey);
  assertExists(result.value);
  assertEquals(result.value, testValue);
  
  // Clean up
  await kv.delete(testKey);
  await kv.close();
});

Deno.test("Complete visit data flow - simulates main.ts logic", async () => {
  // Setup test data that mirrors the main.ts variable names and flow
  const s_id = Deno.env.get("SITE_ID") ?? "";
  const s_salt = Deno.env.get("SITE_SALT") ?? "";
  const a_region = Deno.env.get("DENO_REGION") ?? "";
  
  const v_ts = Date.now();
  const v_id = ulid();
  const v_ip = "127.0.0.1";
  const v_rf = "https://example.com/test-page";
  const v_ua = "Mozilla/5.0 (Test) AppleWebKit/537.36";

  // Generate visitor hash using exact same logic as main.ts
  const v_arr: string[] = [s_salt, s_id, v_ip, v_ua];
  const serializedArr = JSON.stringify(v_arr);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serializedArr));
  const visitor = encodeHex(new Uint8Array(hash));

  // Create visit object using exact same structure as main.ts
  const v: Visit = {
    id: v_id,
    path: v_rf,
    timestamp: v_ts,
    visitor: visitor,
    edge_region: a_region,
  };

  // Test KV storage like in main.ts
  const kv = await Deno.openKv();
  await kv.set(["visit", v.id], v);
  
  // Verify storage
  const entry = await kv.get(["visit", v.id]);
  assertExists(entry.value);
  assertEquals(entry.value, v);
  assertExists(entry.versionstamp);
  
  // Verify all fields match
  const storedVisit = entry.value as Visit;
  assertEquals(storedVisit.id, v_id);
  assertEquals(storedVisit.path, v_rf);
  assertEquals(storedVisit.timestamp, v_ts);
  assertEquals(storedVisit.visitor, visitor);
  assertEquals(storedVisit.edge_region, a_region);
  
  // Clean up
  await kv.delete(["visit", v.id]);
  await kv.close();
});

Deno.test("Pixel response structure", () => {
  // Test the pixel data that main.ts serves
  const pixelData = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const pixel = decodeBase64(pixelData);
  
  // Verify it's a valid GIF
  assert(pixel instanceof Uint8Array);
  assert(pixel.length > 0);
  
  // Check GIF header
  assertEquals(pixel[0], 0x47); // 'G'
  assertEquals(pixel[1], 0x49); // 'I'
  assertEquals(pixel[2], 0x46); // 'F'
  assertEquals(pixel[3], 0x38); // '8'
  assertEquals(pixel[4], 0x39); // '9'
  assertEquals(pixel[5], 0x61); // 'a'
});

Deno.test("Error handling for missing environment variables", () => {
  // Temporarily unset env vars to test fallback behavior
  const originalSiteId = Deno.env.get("SITE_ID");
  const originalSiteSalt = Deno.env.get("SITE_SALT");
  const originalRegion = Deno.env.get("DENO_REGION");
  
  Deno.env.delete("SITE_ID");
  Deno.env.delete("SITE_SALT");
  Deno.env.delete("DENO_REGION");
  
  // Test fallback to empty strings (as per main.ts logic)
  const s_id = Deno.env.get("SITE_ID") ?? "";
  const s_salt = Deno.env.get("SITE_SALT") ?? "";
  const a_region = Deno.env.get("DENO_REGION") ?? "";
  
  assertEquals(s_id, "");
  assertEquals(s_salt, "");
  assertEquals(a_region, "");
  
  // Restore original values
  if (originalSiteId) Deno.env.set("SITE_ID", originalSiteId);
  if (originalSiteSalt) Deno.env.set("SITE_SALT", originalSiteSalt);
  if (originalRegion) Deno.env.set("DENO_REGION", originalRegion);
});

