// a/b assignment, decided in the worker before render. posthog owns the split;
// this only asks it once per visitor per flag and remembers the answer.

export type Arm = 'a' | 'b';

// posthog's default variant names. fixed, so nothing has to be configured
export const VARIANT = {a: 'control', b: 'test'} as const;

// excluded: posthog was slow, down, or left this visitor out of the rollout
const OUT = 'x';

// what posthog accepts as a flag key, and so safe inside a cookie name
const FLAG = /^[A-Za-z0-9_-]{1,100}$/;
export const isFlag = (flag: string | null | undefined): flag is string =>
  !!flag && FLAG.test(flag);

const VID = 'ug_vid';
const cookieFor = (flag: string) => `ug_ab_${flag}`;
const YEAR = 60 * 60 * 24 * 365;
const TIMEOUT = 300;

// counted is false for a preview or an excluded visitor: they render an arm but
// must not reach the results
export type Assignment = {arm: Arm; counted: boolean};

export function readCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    if (key) out[key] = decodeURIComponent(part.slice(at + 1).trim());
  }
  return out;
}

// a remembered answer, or null when posthog has to be asked
export function remembered(stored: string | undefined): Assignment | null {
  if (stored === VARIANT.a) return {arm: 'a', counted: true};
  if (stored === VARIANT.b) return {arm: 'b', counted: true};
  if (stored === OUT) return {arm: 'a', counted: false};
  return null;
}

// anything but an explicit `test` is the control. a flag that is off, missing
// or multivariate beyond two arms never shows B by accident.
export function fromPosthog(json: unknown, flag: string): Assignment {
  const entry = (
    json as {flags?: Record<string, {enabled?: boolean; variant?: unknown}>}
  )?.flags?.[flag];
  if (!entry?.enabled) return {arm: 'a', counted: false};
  if (entry.variant === VARIANT.b) return {arm: 'b', counted: true};
  if (entry.variant === VARIANT.a) return {arm: 'a', counted: true};
  return {arm: 'a', counted: false};
}

type Options = {
  key?: string;
  host?: string;
  fetch?: typeof fetch;
  // injectable so tests do not depend on the platform's id generator
  id?: () => string;
};

export type Ab = ReturnType<typeof createAb>;

export function createAb(request: Request, options: Options = {}) {
  const cookies = readCookies(request.headers.get('Cookie'));
  const param = new URL(request.url).searchParams.get('ug_arm');
  const preview: Arm | null = param === 'a' || param === 'b' ? param : null;
  const doFetch = options.fetch ?? fetch;
  const host = (options.host ?? 'https://us.i.posthog.com').replace(/\/$/, '');

  const setCookies: string[] = [];
  const memo = new Map<string, Promise<Assignment>>();
  let vid = cookies[VID] ?? null;
  // set once any flag has been read, so the response knows it depends on cookies
  let touched = false;

  const distinctId = () => {
    if (!vid) {
      vid = (options.id ?? (() => crypto.randomUUID()))();
      setCookies.push(
        `${VID}=${vid}; Path=/; Max-Age=${YEAR}; SameSite=Lax; Secure`,
      );
    }
    return vid;
  };

  const remember = (flag: string, value: string, session: boolean) =>
    setCookies.push(
      `${cookieFor(flag)}=${value}; Path=/; SameSite=Lax; Secure` +
        // an exclusion lasts the session, so a posthog blip or a flag not yet
        // switched on does not keep a visitor out of the test for good
        (session ? '' : `; Max-Age=${YEAR}`),
    );

  async function ask(flag: string): Promise<Assignment> {
    const known = remembered(cookies[cookieFor(flag)]);
    if (known) return known;

    if (!options.key) return {arm: 'a', counted: false};

    let got: Assignment = {arm: 'a', counted: false};
    try {
      const res = await doFetch(`${host}/flags?v=2`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({api_key: options.key, distinct_id: distinctId()}),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok) got = fromPosthog(await res.json(), flag);
    } catch {
      // timeout or network: control, uncounted
    }
    remember(flag, got.counted ? VARIANT[got.arm] : OUT, !got.counted);
    return got;
  }

  return {
    preview,
    // memoised, so every loader in one request sees the same answer
    arm(flag: string | null | undefined): Promise<Assignment> {
      if (!isFlag(flag)) return Promise.resolve({arm: 'a', counted: false});
      touched = true;
      if (preview) return Promise.resolve({arm: preview, counted: false});
      let pending = memo.get(flag);
      if (!pending) memo.set(flag, (pending = ask(flag)));
      return pending;
    },
    distinctId: () => vid,
    setCookies: () => setCookies,
    touched: () => touched,
  };
}
