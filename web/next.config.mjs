/** Proxy /api/v1/* to the FastAPI backend (backend/run.py, port 8000). */
export default {
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: "http://127.0.0.1:8000/api/v1/:path*" }];
  },
};
