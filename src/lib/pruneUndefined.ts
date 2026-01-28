const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const prune = (value: unknown): unknown => {
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const cleaned = prune(item);
      if (cleaned !== undefined) out.push(cleaned);
    }
    return out;
  }

  // Only recurse into plain objects so we don't accidentally break Firestore FieldValue objects.
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = prune(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }

  return value;
};

export function pruneUndefined<T>(value: T): T {
  return prune(value) as T;
}

