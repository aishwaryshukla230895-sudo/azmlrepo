import http.server
import json
import os
import urllib.request
import urllib.error

PORT = 8501
DEFAULT_ENDPOINT_URL = "https://diabetes-28225164832.centralindia.inference.ml.azure.com/score"

class DiabetesAPIHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        public_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
        super().__init__(*args, directory=public_dir, **kwargs)

    def do_POST(self):
        if self.path == "/api/predict":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                post_data = self.rfile.read(content_length)
                payload = json.loads(post_data.decode("utf-8"))

                api_key = payload.get("api_key", "").strip()
                target_url = payload.get("endpoint_url", DEFAULT_ENDPOINT_URL).strip()
                patient_data = payload.get("patient_data", [])

                if not api_key:
                    self._send_json(400, {"error": "Azure ML Primary API Key is required."})
                    return

                # Format payload exactly as Azure ML MLflow endpoint expects
                mlflow_payload = {
                    "input_data": {
                        "columns": [
                            "Pregnancies",
                            "PlasmaGlucose",
                            "DiastolicBloodPressure",
                            "TricepsThickness",
                            "SerumInsulin",
                            "BMI",
                            "DiabetesPedigree",
                            "Age"
                        ],
                        "index": [0],
                        "data": [patient_data]
                    }
                }

                body = json.dumps(mlflow_payload).encode("utf-8")
                headers = {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AuraHealthDiagnostics/1.0"
                }

                req = urllib.request.Request(target_url, body, headers)
                with urllib.request.urlopen(req) as response:
                    res_body = response.read().decode("utf-8")
                    prediction = json.loads(res_body)
                    self._send_json(200, {"prediction": prediction})

            except urllib.error.HTTPError as error:
                err_info = error.read().decode("utf-8", "ignore")
                self._send_json(error.code, {"error": f"Azure ML Gateway Error ({error.code}): {err_info}"})
            except Exception as e:
                self._send_json(500, {"error": f"Backend Server Error: {str(e)}"})
        else:
            self.send_response(404)
            self.end_headers()

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

if __name__ == "__main__":
    print("=" * 60)
    print(">> AuraHealth AI Diagnostics Web Server")
    print(f">> Connected to Azure ML: diabetes-28225164832")
    print(f">> Serving local web app at: http://localhost:{PORT}")
    print("=" * 60)
    server = http.server.HTTPServer(("", PORT), DiabetesAPIHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n>> Shutting down server...")
        server.server_close()
