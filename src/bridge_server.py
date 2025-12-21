import http.server
import socketserver
import json
import logging
from rag_client import RagClient
from safety_client import SafetyClient

# Configure Logging
logging.basicConfig(level=logging.INFO, format='[Bridge] %(message)s')
log = logging.getLogger("Bridge")

PORT = 8000

# Initialize Clients
try:
    rag_client = RagClient()
    log.info("✅ RAG Client initialized")
except Exception as e:
    log.error(f"❌ RAG Client failed: {e}")
    rag_client = None

try:
    safety_client = SafetyClient()
    log.info("✅ Safety Client initialized")
except Exception as e:
    log.error(f"❌ Safety Client failed: {e}")
    safety_client = None

class BridgeHandler(http.server.SimpleHTTPRequestHandler):
    def _send_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            body = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self._send_response({'error': 'Invalid JSON'}, 400)
            return

        path = self.path

        # --- RAG ENDPOINT ---
        if path == '/rag/query':
            if not rag_client:
                self._send_response({'error': 'RAG service unavailable'}, 503)
                return
            
            query = body.get('query')
            collection = body.get('collection', 'default')
            
            if not query:
                self._send_response({'error': 'Missing query'}, 400)
                return

            log.info(f"RAG Query: {query}")
            try:
                result = rag_client.query_knowledge_base(query, collection)
                self._send_response({'chunk': result})
            except Exception as e:
                log.error(f"RAG Error: {e}")
                self._send_response({'error': str(e)}, 500)
            return

        # --- SAFETY ENDPOINT ---
        elif path == '/safety/check':
            if not safety_client:
                self._send_response({'error': 'Safety service unavailable'}, 503)
                return

            text = body.get('text')
            mode = body.get('mode', 'input') # input or output

            if not text:
                self._send_response({'error': 'Missing text'}, 400)
                return

            log.info(f"Safety Check ({mode}): {text[:50]}...")
            try:
                if mode == 'input':
                    is_safe = safety_client.check_input_safety(text)
                else:
                    is_safe = safety_client.check_output_safety(text)
                
                self._send_response({'safe': is_safe})
            except Exception as e:
                log.error(f"Safety Error: {e}")
                self._send_response({'error': str(e)}, 500)
            return

        else:
            self._send_response({'error': 'Not Found'}, 404)

    def do_GET(self):
        self._send_response({'status': 'online', 'services': ['rag', 'safety']})

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), BridgeHandler) as httpd:
        log.info(f"🚀 DeepFish Python Bridge running on port {PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        httpd.server_close()
