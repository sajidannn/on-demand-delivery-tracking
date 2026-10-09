import { extractToken } from './token-source.js';
import { Request } from 'express';

describe('Token Source', () => {
  beforeEach(() => {
    process.env.AUTH_COOKIE_NAME = 'access_token';
  });

  it('extracts token from Bearer header', () => {
    const req = {
      headers: { authorization: 'Bearer my-header-token' },
      cookies: { access_token: 'my-cookie-token' }
    } as unknown as Request;
    
    expect(extractToken(req)).toEqual({
      token: 'my-header-token',
      source: 'header'
    });
  });

  it('extracts token from cookie if header is not present', () => {
    const req = {
      headers: {},
      cookies: { access_token: 'my-cookie-token' }
    } as unknown as Request;
    
    expect(extractToken(req)).toEqual({
      token: 'my-cookie-token',
      source: 'cookie'
    });
  });

  it('returns null if neither is present', () => {
    const req = {
      headers: {},
      cookies: {}
    } as unknown as Request;
    
    expect(extractToken(req)).toBeNull();
  });
});
