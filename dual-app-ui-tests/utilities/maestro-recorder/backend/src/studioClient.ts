// ─────────────────────────────────────────────────────────────────────────────
// Maestro Studio client — reuses a running `maestro studio` process for
// hierarchy + screenshot fetches instead of spawning the CLI every time.
//
// Why: `execFile('maestro', ['hierarchy'])` spins up a fresh JVM and
// re-establishes the driver connection on every call — typically 1.5–4s on
// iOS and 1–2s on Android. Studio keeps the driver warm and exposes a REST
// endpoint (`/api/device-screen`) that returns the same hierarchy + a base64
// screenshot in one round-trip, usually in 80–250ms.
//
// This module is a *drop-in accelerator*: server.ts calls tryStudioSnapshot()
// first, and only falls back to the CLI if Studio is not reachable.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'http';
import { createHash } from 'crypto';

const STUDIO_HOST = process.env.MAESTRO_STUDIO_HOST || '127.0.0.1';
const STUDIO_PORT = Number(process.env.MAESTRO_STUDIO_PORT || 9999);
const STUDIO_TIMEOUT_MS = Number(process.env.MAESTRO_STUDIO_TIMEOUT_MS || 4000);

export interface StudioHierarchyElement {
  id: string;
  type: string;
  text: string;
  bounds: string;
  clickable: boolean;
  focused: boolean;
}

export interface StudioSnapshot {
  hierarchy: StudioHierarchyElement[];
  screenshot: string | null;   // data URL or null
  hash: string;                 // stable content hash — see hashHierarchy
  source: 'studio';
}

// Persistent http.Agent — keeps a warm TCP connection to Studio open across
// requests. Without this, Node would open/close a socket per fetch and
// negate half the speedup.
const agent = new http.Agent({ keepAlive: true, maxSockets: 4 });

let studioAvailable: boolean | null = null;   // tri-state cache
let lastAvailabilityCheck = 0;
const AVAILABILITY_TTL_MS = 5000;

function httpGet(pathname: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: STUDIO_HOST,
        port: STUDIO_PORT,
        path: pathname,
        method: 'GET',
        agent,
        headers: { accept: 'application/json' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`studio ${pathname} -> ${res.statusCode}`));
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`studio ${pathname} timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

// Content hash that ignores volatile fields (scroll offsets, animation frames)
// so we don't broadcast identical hierarchies as "updates".
export function hashHierarchy(elements: StudioHierarchyElement[]): string {
  const h = createHash('sha1');
  for (const el of elements) {
    // Only fields that materially change the user-visible tree.
    h.update(el.type);
    h.update('|');
    h.update(el.text);
    h.update('|');
    h.update(el.bounds);
    h.update('|');
    h.update(el.clickable ? '1' : '0');
    h.update('\n');
  }
  return h.digest('hex');
}

// Studio's tree nodes carry richer attributes than our lean HierarchyElement.
// Flatten and normalize into the same shape as the CLI parser produces so
// downstream consumers (frontend, OCR merge, etc.) don't need to know which
// source produced the data.
function normalizeStudioNode(
  node: any,
  out: StudioHierarchyElement[],
  index = { i: 0 },
): void {
  if (!node || typeof node !== 'object') return;

  const attrs = node.attributes || {};
  const text: string = (
    attrs['text'] ??
    attrs['hintText'] ??
    attrs['accessibilityText'] ??
    attrs['accessibility-label'] ??
    attrs['content-desc'] ??
    ''
  ).toString();

  const bounds: string =
    (attrs['bounds'] ?? attrs['frame'] ?? '').toString() || '0,0,0,0';

  const clickable =
    attrs['clickable'] === 'true' ||
    attrs['clickable'] === true ||
    attrs['enabled'] === 'true';

  const focused =
    attrs['focused'] === 'true' || attrs['focused'] === true;

  // Only surface nodes that have meaningful content — Studio returns every
  // internal layout container which would balloon the tree.
  if (text || clickable) {
    out.push({
      id: attrs['resource-id'] || `studio-${index.i++}`,
      type: (attrs['class'] || attrs['type'] || 'element')
        .toString()
        .split('.')
        .pop() || 'element',
      text,
      bounds,
      clickable,
      focused,
    });
  }

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) normalizeStudioNode(child, out, index);
}

async function isStudioReachable(): Promise<boolean> {
  const now = Date.now();
  if (
    studioAvailable !== null &&
    now - lastAvailabilityCheck < AVAILABILITY_TTL_MS
  ) {
    return studioAvailable;
  }
  try {
    await httpGet('/api/device-screen', 1500);
    studioAvailable = true;
  } catch {
    studioAvailable = false;
  }
  lastAvailabilityCheck = now;
  return studioAvailable;
}

// Force-refresh the reachability probe — call this after starting Studio,
// switching devices, or on repeated failures so we retry immediately.
export function invalidateStudioAvailability(): void {
  studioAvailable = null;
  lastAvailabilityCheck = 0;
}

/**
 * Fetch hierarchy + screenshot from a running `maestro studio` instance.
 * Returns null when Studio is not reachable — the caller should fall back
 * to the CLI path.
 */
export async function tryStudioSnapshot(): Promise<StudioSnapshot | null> {
  if (!(await isStudioReachable())) return null;

  try {
    const raw = await httpGet('/api/device-screen', STUDIO_TIMEOUT_MS);
    const payload = JSON.parse(raw);

    const elements: StudioHierarchyElement[] = [];
    // Studio has shipped two response shapes over its lifetime:
    //   { tree: {...}, screenshot: "data:image/png;base64,..." }
    //   { deviceScreen: { tree, screenshot } }
    const root = payload.deviceScreen?.tree ?? payload.tree ?? payload;
    normalizeStudioNode(root, elements);

    const screenshotRaw: string | undefined =
      payload.deviceScreen?.screenshot ?? payload.screenshot;
    const screenshot = screenshotRaw
      ? screenshotRaw.startsWith('data:')
        ? screenshotRaw
        : `data:image/png;base64,${screenshotRaw}`
      : null;

    return {
      hierarchy: elements,
      screenshot,
      hash: hashHierarchy(elements),
      source: 'studio',
    };
  } catch (err) {
    // A single failure shouldn't blacklist Studio forever — the AVAILABILITY_TTL
    // cache will re-probe on the next call after the TTL elapses.
    invalidateStudioAvailability();
    return null;
  }
}

export function studioEndpoint(): string {
  return `http://${STUDIO_HOST}:${STUDIO_PORT}`;
}
