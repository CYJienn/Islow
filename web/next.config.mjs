/** BACKEND_URL points to the hosted API; local development uses port 8000. */
export default {
  experimental: { proxyTimeout: 300_000 }, // the council call (search + several model calls) takes over the 30 s default
  async rewrites() {
    const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    return [{ source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` }];
  },
};
