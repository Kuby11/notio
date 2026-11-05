# ADR 0019. Media blocks and files in Cloudflare R2

- **Status:** accepted
- **Date:** 2026-10-24

## Context

We need "emoji, file, image, video" blocks with local file uploads and link insertion, limits
(20 MB image, 50 MB video, 20 MB other) and toasts for size errors. Until now the image block was a
stub and media-service did not exist.

Constraints and requirements:

- only the gateway exists on the internet; services talk through Service Bindings;
- arbitrary links from content cannot be rendered trustingly — http/https only (HttpUrlSchema is
  already in the contracts);
- BlockContent is flat JSON in a `blocks` row: a media block must serialise entirely, otherwise
  autosave deletes the node;
- Workers accepts request bodies up to 100 MB — a direct multipart video upload (50 MB) works without
  presigned URLs or the S3 API.

## Decision

- **media-service + R2.** The new `services/media-service` owns the bucket (`MEDIA` binding), and
  metadata lives in the object's `customMetadata` — no separate database needed. The object key is
  the file UUID: the id is unpredictable and the bucket cannot be listed from outside.
- **Limits and the allowlist are checked twice.** The contract provides `maxUploadSizeForMime`
  (image/* → 20 MB, video/* → 50 MB, other → 20 MB) and a MIME allowlist; the client checks before
  sending and shows a toast, and the service checks again at the boundary (413 PAYLOAD_TOO_LARGE /
  415 UNSUPPORTED_MEDIA_TYPE) — trusting the client has no place here.
- **Upload: POST /api/media/files (multipart)** with workspaceId and the file; the gateway proxies
  `/api/media` through a Service Binding and injects the signed actor. The response is FileMeta per
  the contract.
- **Serving: GET /api/media/files/:id** streams the object from R2 with `Accept-Ranges`,
  `Content-Range` (single range — `<video>` needs seeking), ETag and `Cache-Control: immutable` (ids
  never change). HEAD returns metadata without a body, and `?download=1` turns the response into a
  download with the original name (Content-Disposition, UTF-8).
- **Blocks store a source, not an upload URL:** `image`/`video` — `fileId | null` + `url | null` +
  caption, `file` — plus `name` and `sizeBytes`, `emoji` — a single character. The schema requires at
  least one source (superRefine): empty placeholders are neither serialised nor saved — the same
  approach as subpages without a pageId. The public file URL is built by the client:
  `{gateway}/api/media/files/{id}`.
- **A node view instead of markup.** Uploading and the player need interactivity that renderHTML
  cannot provide: an empty block shows a card ("Choose file" / a validated http(s) link), a filled one
  shows the media with a caption. The network arrives through a WeakMap bridge (media-bridge) from
  the Editor component: extensions know nothing about fetch or env. The inputs stop keyboard events,
  otherwise ProseMirror would intercept typing.
- **Toasts** — a minimal `shared/ui/toast` (zustand + one `<Toaster/>` in providers): limit and type
  errors are visible at any failure point.
- **The table became colourable**, like the other text blocks: color/backgroundColor in content,
  data-attribute syncing through TableDomAttrs (the resizing plugin's TableView does not apply node
  attrs).
- **DragHandle is centred on the block**: placement `left` instead of `left-start`.

## Alternatives

- **Presigned URLs to the R2 S3 API.** Removes traffic through the Worker, but requires S3 keys, a
  separate signing endpoint and CORS setup; direct upload is enough for 50 MB.
- **Metadata in D1.** Gives fast workspace search, but duplicates R2's customMetadata; we will return
  to a database once file lists appear.
- **MIME sniffing by content.** More reliable than trusting the header, but Workers has no cheap
  detector; the allowlist plus size closes the "malicious upload" scenario at this stage.
- **Custom blockId URLs.** Proxying through the gateway keeps a single domain (no CORS) and
  authentication in one place.

## Consequences

- Reading a file (GET/HEAD /api/media/files/:id) is public: `<img>`, `<video>` and download links
  cannot send an Authorization header, so access relies on UUID unpredictability (a capability URL,
  like Notion attachments) plus the gateway rate limit. Upload and the rest of `/api/*` require a
  token; per-file permissions arrive with page permissions.
- The R2 bucket is not configured for production: `wrangler r2 bucket create notio-media` and a
  media-service deployment are needed (see wrangler.jsonc).
- Video seeks with one range per request; multiple Range headers are ignored (the whole object is
  returned with 200).
- The emoji block uses a fixed set from the picker; search/recent emoji arrive with rich text.
