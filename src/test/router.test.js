import { describe, it, expect } from 'vitest';
import { parsePath, pathFor, ROUTES } from '../lib/router.js';

describe('router.js', () => {
  describe('parsePath', () => {
    it('parses /b/<code> paths to result route with the code', () => {
      const result = parsePath('/b/8600043000016');
      expect(result.route).toBe(ROUTES.RESULT);
      expect(result.code).toBe('8600043000016');
    });

    it('requires at least 8 digits and at most 14 in /b/ codes', () => {
      // Valid: 8, 12, 13 digit codes
      expect(parsePath('/b/12345678')).toEqual({ route: ROUTES.RESULT, code: '12345678' });
      expect(parsePath('/b/123456789012')).toEqual({ route: ROUTES.RESULT, code: '123456789012' });
      expect(parsePath('/b/1234567890123')).toEqual({ route: ROUTES.RESULT, code: '1234567890123' });

      // Invalid: too short or non-numeric
      expect(parsePath('/b/1234567').route).toBe(ROUTES.HOME);
      expect(parsePath('/b/abc12345').route).toBe(ROUTES.HOME);
    });

    it('parses / to home', () => {
      const result = parsePath('/');
      expect(result.route).toBe(ROUTES.HOME);
      expect(result.code).toBeNull();
    });

    it('parses Albanian static paths correctly', () => {
      expect(parsePath('/skano').route).toBe(ROUTES.SCANNER);
      expect(parsePath('/eksploro').route).toBe(ROUTES.EXPLORE);
      expect(parsePath('/pse').route).toBe(ROUTES.MANIFESTO);
      expect(parsePath('/historiku').route).toBe(ROUTES.HISTORY);
    });

    it('falls back to home for unknown paths', () => {
      const result = parsePath('/unknown');
      expect(result.route).toBe(ROUTES.HOME);
      expect(result.code).toBeNull();
    });

    it('tolerates trailing slashes', () => {
      expect(parsePath('/skano/').route).toBe(ROUTES.SCANNER);
      expect(parsePath('/b/8600043000016/').route).toBe(ROUTES.RESULT);
      expect(parsePath('//').route).toBe(ROUTES.HOME);
    });
  });

  describe('pathFor', () => {
    it('generates /b/<code> for result routes', () => {
      const path = pathFor(ROUTES.RESULT, '8600043000016');
      expect(path).toBe('/b/8600043000016');
    });

    it('returns / when code is empty for result route', () => {
      expect(pathFor(ROUTES.RESULT, '')).toBe('/');
      expect(pathFor(ROUTES.RESULT, null)).toBe('/');
    });

    it('strips non-numeric characters from code', () => {
      const path = pathFor(ROUTES.RESULT, '860-004-3000016');
      expect(path).toBe('/b/8600043000016');
    });

    it('generates correct paths for static routes', () => {
      expect(pathFor(ROUTES.HOME)).toBe('/');
      expect(pathFor(ROUTES.SCANNER)).toBe('/skano');
      expect(pathFor(ROUTES.EXPLORE)).toBe('/eksploro');
      expect(pathFor(ROUTES.MANIFESTO)).toBe('/pse');
      expect(pathFor(ROUTES.HISTORY)).toBe('/historiku');
    });

    it('round-trips: pathFor(parsePath(path)) === path', () => {
      const paths = [
        '/',
        '/skano',
        '/eksploro',
        '/pse',
        '/historiku',
        '/b/8600043000016',
        '/b/12345678',
      ];

      for (const originalPath of paths) {
        const parsed = parsePath(originalPath);
        const regenerated = pathFor(parsed.route, parsed.code);
        expect(regenerated).toBe(originalPath);
      }
    });
  });
});
