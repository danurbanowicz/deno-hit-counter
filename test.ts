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

Deno.test("Visitor hash generation", async () => {
  const s_salt = "test-salt-123";
  const s_id = "test-site-id";
  const v_ip = "192.168.1.1";
  const v_ua = "Mozilla/5.0 (Test Browser)";

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

Deno.test("Visit object creation", () => {
  const v_ts = Date.now();
  const v_id = ulid();
  const v_rf = "https://example.com/page";
  const visitor = "test-visitor-hash";
  const a_region = "test-region";

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

// Integration test for Oak application setup
Deno.test("Oak application can be created", () => {
  const app = new Application();
  assertExists(app);
  assert(app instanceof Application);
});

