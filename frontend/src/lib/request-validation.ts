export function getRequiredRequestBodyError(exampleBody: string, actualBody: string): string | null {
  return exampleBody.trim() && !actualBody.trim() ? "Request body is required" : null;
}

export function getExactRequestValueErrors(example: unknown, actual: unknown): string[] {
  const errors: string[] = [];
  compareExactValues(example, actual, "", errors, 0);
  return errors;
}

function compareExactValues(
  example: unknown,
  actual: unknown,
  path: string,
  errors: string[],
  depth: number
): void {
  if (depth > 100) {
    errors.push("Request body nesting is too deep");
    return;
  }

  if (Array.isArray(example)) {
    if (!Array.isArray(actual)) {
      errors.push(`Value mismatch at "${displayPath(path)}"`);
      return;
    }
    if (example.length !== actual.length) {
      errors.push(`Item count mismatch at "${displayPath(path)}"`);
      return;
    }
    example.forEach((item, index) => {
      compareExactValues(item, actual[index], `${path}[${index}]`, errors, depth + 1);
    });
    return;
  }

  if (isRecord(example)) {
    if (!isRecord(actual)) {
      errors.push(`Value mismatch at "${displayPath(path)}"`);
      return;
    }
    for (const key of Object.keys(example)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        errors.push(`Missing required field "${childPath}"`);
      } else {
        compareExactValues(example[key], actual[key], childPath, errors, depth + 1);
      }
    }
    for (const key of Object.keys(actual)) {
      if (!Object.prototype.hasOwnProperty.call(example, key)) {
        errors.push(`Unexpected field "${path ? `${path}.${key}` : key}"`);
      }
    }
    return;
  }

  if (!Object.is(example, actual)) {
    errors.push(`Value mismatch at "${displayPath(path)}"`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function displayPath(path: string): string {
  return path || "request body";
}
