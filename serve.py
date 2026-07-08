import http.server
import os

PORT = 3000
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def do_GET(self):
        # Serve the file if it exists, otherwise serve index.html (SPA fallback)
        path = self.translate_path(self.path)
        if os.path.isfile(path):
            return super().do_GET()
        # Fallback to index.html for SPA routes
        self.path = "/index.html"
        return super().do_GET()

if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), SPAHandler) as httpd:
        print(f"SPA server running at http://localhost:{PORT}")
        httpd.serve_forever()
