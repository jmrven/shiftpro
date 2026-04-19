export function assertBody<T>(
  body: unknown,
  requiredFields: (keyof T)[]
): asserts body is T {
  if (!body || typeof body !== 'object') {
    throw { code: 'VALIDATION_ERROR', message: 'Request body must be a JSON object' };
  }
  const missing = requiredFields.filter((f) => !(f as string in (body as object)));
  if (missing.length > 0) {
    throw {
      code: 'VALIDATION_ERROR',
      message: `Missing required fields: ${missing.join(', ')}`,
    };
  }
}
