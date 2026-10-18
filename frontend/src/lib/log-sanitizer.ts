const REDACTED = "[REDACTED]";

const SENSITIVE_NAME_PATTERN =
  /(?:authorization|cookie|credential|password|passcode|passwd|secret|token|api[-_]?key|apikey|signature)/i;

const PRIVATE_INFRASTRUCTURE_HEADERS = [
  "forwarded",
  "x-forwarded-",
  "x-mockingbird-",
  "x-real-ip",
  "x-vercel-",
];

export function sanitizeHeadersForLog(
  headers: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => {
      const normalizedName = name.trim().toLowerCase();
      const privateInfrastructureHeader = PRIVATE_INFRASTRUCTURE_HEADERS.some(
        (item) => normalizedName === item || normalizedName.startsWith(item)
      );
      return [
        name,
        privateInfrastructureHeader || SENSITIVE_NAME_PATTERN.test(normalizedName)
          ? REDACTED
          : value,
      ];
    })
  );
}

export function sanitizeBodyForLog(body: string): string {
  if (!body.trim()) return body;

  try {
    return JSON.stringify(sanitizeValue(JSON.parse(body)), null, 2);
  } catch {
    // The body may be XML, form data, plain text, or a truncated JSON preview.
  }

  if (!body.includes("<") && body.includes("=")) {
    try {
      const form = new URLSearchParams(body);
      let changed = false;
      for (const name of Array.from(form.keys())) {
        if (SENSITIVE_NAME_PATTERN.test(name)) {
          form.set(name, REDACTED);
          changed = true;
        }
      }
      if (changed) return form.toString();
    } catch {
      // Fall through to conservative text replacements.
    }
  }

  return sanitizeStructuredText(body);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 50) return "[REDACTED: maximum nesting depth]";
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([name, child]) => [
        name,
        SENSITIVE_NAME_PATTERN.test(name)
          ? REDACTED
          : sanitizeValue(child, depth + 1),
      ])
    );
  }
  return value;
}

function sanitizeStructuredText(value: string): string {
  let sanitized = value;

  // XML element values, including namespaced elements such as auth:Password.
  sanitized = sanitized.replace(
    /(<(?:[\w.-]+:)?(authorization|cookie|credential|password|passcode|passwd|secret|token|api[-_]?key|apikey|signature)\b[^>]*>)[\s\S]*?(<\/(?:[\w.-]+:)?\2\s*>)/gi,
    `$1${REDACTED}$3`
  );

  // JSON-style string and primitive values. This also protects truncated JSON previews.
  sanitized = sanitized.replace(
    /((?:"|')(?:authorization|cookie|credential|password|passcode|passwd|secret|token|api[-_]?key|apikey|signature)(?:"|')\s*:\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,}\r\n]+)/gi,
    `$1"${REDACTED}"`
  );

  return sanitized;
}
