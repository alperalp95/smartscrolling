import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__');

export function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

export function jsonFixture(name) {
  return JSON.parse(fixture(name));
}

/**
 * Ağ olmadan toplayıcı testi için sahte http: `route(url)` her istek için yanıt JSON'u döner.
 * @param {(url: URL) => any} route
 */
export function fakeHttp(route) {
  const calls = [];
  return {
    calls,
    async getJson(url) {
      const u = new URL(String(url));
      calls.push(u);
      return route(u);
    },
  };
}
