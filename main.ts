// Import dependencies
import {
  Application,
  crypto,
  encodeHex,
  decodeBase64,
  ulid
} from "./deps.ts";

// Import models
import { Visit } from "./models.ts";

// Register the Oak server
const app = new Application();

// Open a Deno KV connection
const kv = await Deno.openKv();

// The 1px x 1px transparent GIF as a Base64-encoded string
const pixel = decodeBase64("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

// The site's ID
const s_id: string = Deno.env.get("SITE_ID") ?? "";

// The site's secret salt
const s_salt: string = Deno.env.get("SITE_SALT") ?? "";

// The location of the Edge node that handled the request (for debugging)
const a_region: string = Deno.env.get("DENO_REGION") ?? "";

// Capture visit data and write to the DB
app.use(async (ctx, next) => {

  await next();

  const v_ts: number = Date.now(); // Visit timestamp
  const v_id: string = ulid(); // ULID for the visit
  const v_ip: string = ctx.request.ip; // Visit request IP
  const v_rf: string = ctx.request.headers.get("Referer") || "unknown"; // Referrer string
  const v_ua: string = ctx.request.headers.get("User-Agent") || "unknown"; // Browser UA string

  // Generate the visitor hash

  // Build an array of the site salt, site ID, IP, and UA string
  const v_arr: string[] = [s_salt, s_id, v_ip, v_ua];

  // Serialize the array
  const serializedArr = JSON.stringify(v_arr);

  // Hash the serialized array
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serializedArr));

  // Finally, output the hash as a string
  const visitor = encodeHex(new Uint8Array(hash));

  try {

    // Build a visit object from the Visit model
    const v: Visit = {
      id: v_id,
      path: v_rf,
      timestamp: v_ts,
      visitor: visitor,
      edge_region: a_region,
    };

    // Write the visit object to Deno KV
    await kv.set(["visit", v.id], v);

    // Confirm that the visit was successfully written
    const entry = await kv.get(["visit", v.id]);
    console.log(`Visit ${v.id} was successfully stored with versionstamp: ${entry.versionstamp}`);

  } catch (error) {
    // If something goes wrong while making the request, we log
    // the error for our reference.
    console.log(error);
    // TODO: add a more descriptive error for our use
  }

});

// Return a response immediately (the pixel)
app.use((ctx) => {
  ctx.response.status = 200;
  ctx.response.type = "image/gif";
  // Ask the browser to always request the pixel
  ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  // Set a CORS header
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.body = pixel;
  // Log result to Deno
  console.log("Pixel served");
});

// Start the server
await app.listen({ port: 8080 });