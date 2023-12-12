// A simple Deno app to serve a pixel and capture some visit data from the request.
// Anonymizes the visit and stores it in a DynamoDB table.

import { Application } from "https://deno.land/x/oak@v11.1.0/mod.ts"
import * as base64 from "https://deno.land/x/base64@v0.2.1/mod.ts";
import { crypto, toHashString } from "https://deno.land/std@0.167.0/crypto/mod.ts";

// Register the Oak server
const app = new Application();

const kv = await Deno.openKv();

// The 1px x 1px transparent GIF as a Base64-encoded string
// We need to convert to a UINT8 Array (akin to isBase64Encoded: true)
const pixel = base64.toUint8Array("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

// The site's ID
const s_id: string = "mY51t31d";

// The site's secret salt
const s_salt: string = Deno.env.get("SITE_SALT");

// The location of the Edge node that handled the request (for debugging)
const a_region: string = Deno.env.get("DENO_REGION");

// TODO: declare common bindings here
// TODO: validate request (isBot, rateLimit), match request to a site

// Model an interface for the visit object
// TODO: move interfaces into a ./models.ts file
interface Visit {
  id: string;
  path: string;
  timestamp: number;
  visitor: string;
  edge_region: string;
}

// Capture visit data and write to the DB
app.use(async (ctx, next) => {

  await next();
  //const url: string = ctx.request.url; // use this to grab the site id from the pixel path
  const v_ts: number = Date.now();
  const v_id: string = crypto.randomUUID();
  const v_ip: string = ctx.request.ip;
  const v_rf: string = ctx.request.headers.get("Referer");
  const v_ua: string = ctx.request.headers.get("User-Agent");

  // Anonymize the visitor

  // 1. Make array of site salt, site ID, IP, and UA string
  const v_arr: string[] = [s_salt, s_id, v_ip, v_ua];

  // 2. Serialize the array
  const serializedArr = JSON.stringify(v_arr);

  // 3. Generate the visitor hash from the serialized array
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serializedArr),
  );

  // 4. Finally, output the hash as a string
  const visitor = toHashString(hash);

  try {

    // Shape the visit object using the Visit interface
    const v: Visit = {
      id: v_id,
      path: v_rf || "unknown",
      timestamp: v_ts,
      visitor: visitor,
      edge_region: a_region,
    };

    // Write the visit object to Deno KV
    await kv.set(["hit", v.id], v);

    // TODO confirm that the data was successfully

  } catch (error) {
    // If something goes wrong while making the request, we log
    // the error for our reference.
    console.log(error);
    // TODO: add a more descriptive error for our use
  }

});

// Return our response immediately (the pixel)
app.use((ctx, Status) => {
  ctx.response.status = Status.OK;
  ctx.response.type = "image/gif";
  ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.body = pixel;
  console.log("Pixel served");
});

await app.listen({ port: 8080 });