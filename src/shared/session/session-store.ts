const STORAGE_KEY = "pitch.session";

export type Session = {
  token: string;
  email: string;
  expiresAt: number;
};

type Claims = {
  email: string;
  exp: number;
};

const listeners = new Set<() => void>();

let session: Session | null = null;
let loaded = false;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): Session | null {
  ensureLoaded();
  return session;
}

export function getServerSnapshot(): null {
  return null;
}

export function getToken(): string | null {
  return getSnapshot()?.token ?? null;
}

export function setSession(token: string): void {
  const claims = readClaims(token);
  if (!claims || claims.exp * 1000 <= Date.now()) {
    throw new Error("The access token is missing a valid expiry.");
  }
  session = {
    token,
    email: claims.email,
    expiresAt: claims.exp * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token }));
  loaded = true;
  emit();
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  session = null;
  loaded = true;
  emit();
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") {
    loaded = true;
    return;
  }
  loaded = true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isTokenRecord(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const claims = readClaims(parsed.token);
    if (!claims || claims.exp * 1000 <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    session = {
      token: parsed.token,
      email: claims.email,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function readClaims(token: string): Claims | null {
  const part = token.split(".")[1];
  if (!part) {
    return null;
  }
  try {
    const json: unknown = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (!isClaims(json)) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

function isClaims(value: unknown): value is Claims {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    "exp" in value &&
    typeof value.email === "string" &&
    typeof value.exp === "number"
  );
}

function isTokenRecord(value: unknown): value is { token: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    typeof value.token === "string"
  );
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}
