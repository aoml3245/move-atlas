// SPDX-License-Identifier: AGPL-3.0-only
// Resolve our assets from either a local root or a GitHub project Pages path.
export function assetUrl(path, base = document.baseURI) {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path.replace(/^\/+/, ''), base).href;
}
