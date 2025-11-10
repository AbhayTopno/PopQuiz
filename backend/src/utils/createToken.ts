import jwt from 'jsonwebtoken';
import type { Response, CookieOptions } from 'express';

const parseBoolean = (value: string | undefined) =>
  value !== undefined && value.toLowerCase() === 'true';

const normalizeSameSite = (value: string | undefined): 'lax' | 'strict' | 'none' | undefined => {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'lax' || lower === 'strict' || lower === 'none') {
    return lower;
  }
  console.error(`Ignoring unsupported COOKIE_SAMESITE value: ${value}`);
  return undefined;
};

const generateToken = (res: Response, userId: string): string => {
  const secret = process.env.JWT_SECRET || '';
  const token: string = jwt.sign({ userId }, secret, {
    expiresIn: '7d',
  });

  const secureOverride =
    process.env.COOKIE_SECURE !== undefined ? parseBoolean(process.env.COOKIE_SECURE) : undefined;
  const sameSiteOverride = normalizeSameSite(process.env.COOKIE_SAMESITE);
  const domain = process.env.COOKIE_DOMAIN;

  const secure = secureOverride ?? process.env.NODE_ENV === 'production';
  const sameSite = sameSiteOverride ?? (secure ? 'none' : 'lax');

  // Enforce spec compliance: SameSite=None requires Secure=true
  const finalSecure = sameSite === 'none' ? true : secure;
  if (sameSite === 'none' && !secure && secureOverride === false) {
    console.error('sameSite=None requires secure cookies; overriding COOKIE_SECURE to true.');
  }

  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: finalSecure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };

  if (domain) {
    cookieOptions.domain = domain;
  }

  res.cookie('jwt', token, cookieOptions);

  return token;
};

export default generateToken;
