// Prefix for files in public/ when the site is served from a sub-path (GitHub Pages: /membrain). next/link adds the
// base path by itself; plain <a>, <img>, <video> and next/image with a string src do not.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const asset = (path: string) => `${BASE_PATH}${path}`;
