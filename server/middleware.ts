import type { NextFunction, Request, Response } from 'express';
import { verifyWorkspaceToken } from './sessionStore.ts';
export {
  isValidIncomingAirPayload,
  isValidIncomingIndoorPayload,
} from '../src/services/validation.ts';

export interface AuthenticatedRequest extends Request {
  ownerId?: string;
}

const rateWindows = new Map<string, { count: number; resetAt: number }>();

/**
 * Applies iframe-compatible HTTP security headers across all Express responses.
 * Intentionally omits X-Frame-Options so embedded AI Studio preview remains functional.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

/**
 * Sliding-window per-actor rate limiter protecting session issuance, geocoding, and Gemini quota.
 */
export function rateLimit(bucket: string, maxRequests: number, windowMs: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const actor = req.ownerId || req.ip || 'unknown';
    const key = `${bucket}:${actor}`;
    const now = Date.now();
    const entry = rateWindows.get(key);

    if (!entry || entry.resetAt <= now) {
      if (rateWindows.size > 1000) {
        const oldest = rateWindows.keys().next().value;
        if (oldest) rateWindows.delete(oldest);
      }
      rateWindows.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests in a short window. Please wait a moment before retrying.',
      });
      return;
    }

    entry.count += 1;
    next();
  };
}

/**
 * Verifies the HMAC-signed in-memory workspace Bearer token on protected endpoints.
 */
export function requireWorkspaceAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const ownerId = verifyWorkspaceToken(req.headers.authorization);
  if (!ownerId) {
    res.status(401).json({
      error: 'Authentication required. Initialize a workspace session via /api/session.',
    });
    return;
  }
  req.ownerId = ownerId;
  next();
}
