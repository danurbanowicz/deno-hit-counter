# Deno Hit Counter

A simple [Deno](https://deno.com) app written in TypeScript that responds to a http request with a base64-encoded pixel GIF, collects some request data and anonymizes it, then stores it in a [Deno KV](https://docs.deno.com/kv/manual) key/value data store.

It's an example of how you could count visits to your website's pages in a privacy-respecting way.

## How it works

When the pixel `<img>` tag is present on a page on your website, a visit to that page will trigger a request to the Deno app, and a transparent 1x1 pixel GIF is served. In the background, some data is collected from the request:-

* Visit time
* Visit referrer path
* Visitor IP address
* Visitor user agent
* The edge location handling the request

A cryptographic hash is generated from the visitor IP and user agent string, and the secret `SITE_ID` and `SITE_SALT` environment variables (set in the Deno app) in order to increase the entropy of the resulting visitor hash.

The idea is that this hash will identify a visitor as unique without storing the contents used to produce the hash.

The visitor hash along with a ULID for the visit, plus some other data is then stored in Deno's KV key/value storage:

```
["visit","01HHH3KWR79B2ZPNPXRC64MJMK"] 

{
  "id":"01HHH3KWR79B2ZPNPXRC64MJMK",
  "path":"https://www.example.com/my-page/",
  "timestamp":1702455014151,
  "visitor":"bd3cc093db04ecd0d113c62cb436258b2005008bc526c229edae25e2c2544e62",
  "edge_region":"europe-southwest1"
}
```

This provides enough data to reliably identify if a visitor is unique and therefore be able to "count" them while they navigate the website, and at the same time not storing any personally identifiable information (PII).

## Limitations

Once the anonymized visit data is stored, the app doesn't do anything more with it. You could trivially sort and display the data in some kind of chart.

I'd also suggest setting an expiry on the data stored in Deno KV e.g. 30 days which is easy to do using Deno KV's [expireIn](https://docs.deno.com/kv/manual/key_expiration).

I call this app a "hit counter" because it's unable to collect one of the most useful pieces of data about a website page visit: the page request `Referer`. Without some clientside JS, the app is only able to collect the `Referer` header from the pixel GIF request itself, not the page that the visitor arrived at your website _from_. That's probably a serious limitation for most website analytics use-cases.

## Usage

1. Clone this repo and push to GitHub
2. Create a new Deno Deploy project and connect your repo to it
3. Add `SITE_SALT` and `SITE_ID` environment variables to your Deno Deploy project (the values can be anything but the salt should ideally be at least 16 characters in length)
4. Add the image tag to the pages you want to track, before the closing `</body>` tag.

```
<img src="https://deno-hit-counter.deno.dev" width="1" height="1" alt="Pixel">
```
5. Load a page with the pixel present or hit your endpoint directly, and you should see the visit logged in your project's Deno KV dashboard

## Testing

Use the Deno test runner to the the test located at `test.ts` with: `deno task start`

## Thanks

Thanks to [@oliverjam](https://github.com/oliverjam) for the inspiration from his blog post [Build your own analytics with Netlify Functions](https://oliverjam.es/articles/diy-analytics-netlify-functions).