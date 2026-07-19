// Erreur applicative avec code métier + statut HTTP, format aligné sur API_CONTRACT.md.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  unauthorized: (msg = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', msg),
  invalidCredentials: (msg = 'Invalid credentials') =>
    new AppError(401, 'INVALID_CREDENTIALS', msg),
  forbidden: (msg = 'Forbidden') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Not found') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (code: string, msg: string) => new AppError(409, code, msg),
  unprocessable: (code: string, msg: string, details?: unknown) =>
    new AppError(422, code, msg, details),
};
