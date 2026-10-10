/** Proxy /api/v1/* to the FastAPI backend (backend/run.py, port 8000). */
export default {
  experimental: { proxyTimeout: 300_000 }, // the council call (search + several model calls) takes over the 30 s default
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: "http://127.0.0.1:8000/api/v1/:path*" }];
  },
};
