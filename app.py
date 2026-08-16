from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response, stream_with_context
import sqlite3
import os
import json
import re
import certifi
import threading
import time as time_module
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from authlib.integrations.flask_client import OAuth
 
# ✅ Fix SSL EOF error on Windows
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
os.environ['SSL_CERT_FILE'] = certifi.where()
 
app = Flask(__name__)
def init_db():
    conn = sqlite3.connect("users.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            date TEXT NOT NULL,
            duration_minutes INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

init_db()
from flask_cors import CORS
CORS(app)
from dotenv import load_dotenv
load_dotenv()

app.secret_key = os.environ.get("SECRET_KEY")
GROQ_API_KEY         = os.environ.get("GROQ_API_KEY")
GOOGLE_CLIENT_ID     = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
 
oauth  = OAuth(app)
google = oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile', 'verify': certifi.where()}
)
 
# ── Database ───────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect("users.db")
    conn.row_factory = sqlite3.Row
    return conn
 
# ── Auth routes ────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("login.html")
 
@app.route("/login", methods=["POST"])
def login():
    email    = request.form["email"]
    password = request.form["password"]
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    conn.close()
    if user and check_password_hash(user["password"], password):
        session["user"] = user["username"]
        return redirect("/dashboard")
    return "Invalid Email or Password ❌"
 
@app.route("/login/google")
def login_google():
    redirect_uri = url_for("authorize_google", _external=True)
    return google.authorize_redirect(redirect_uri)
 
@app.route("/authorize/google")
def authorize_google():
    try:
        token     = google.authorize_access_token()
        user_info = token.get('userinfo')
        if not user_info:
            return redirect(url_for('home') + '?error=google_no_info')
        email = user_info.get("email")
        name  = user_info.get("name") or email.split("@")[0]
        conn  = get_db()
        user  = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not user:
            dummy_password = generate_password_hash(os.urandom(24).hex())
            conn.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                         (name, email, dummy_password))
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        conn.close()
        session["user"] = user["username"]
        return redirect("/dashboard")
    except Exception as e:
        print(f"Google OAuth error: {e}")
        return '''<html><head><meta http-equiv="refresh" content="4;url=/">
            <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f0eaff;margin:0;}
            .box{background:white;padding:32px;border-radius:16px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:400px;}
            h2{color:#7c3aed;}p{color:#555;}a{color:#7c3aed;}</style></head>
            <body><div class="box"><h2>⚠️ Google Login Unavailable</h2>
            <p>Please use <strong>email &amp; password</strong> login instead.</p>
            <p style="font-size:.85rem;color:#999;">Redirecting… <a href="/">Go now</a></p>
            </div></body></html>'''
 
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username        = request.form["username"]
        email           = request.form["email"]
        password        = request.form["password"]
        hashed_password = generate_password_hash(password)
        conn = get_db()
        conn.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                     (username, email, hashed_password))
        conn.commit()
        conn.close()
        return redirect(url_for("home"))
    return render_template("register.html")
 
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")
 
# ── Page routes ────────────────────────────────────────────────────────────────
@app.route("/dashboard")
def dashboard():
    if "user" in session:
        return render_template("dashboard.html", user=session["user"])
    return redirect("/")
 
@app.route("/chatbot")
def chatbot():
    if "user" in session:
        return render_template("chatbot.html", user=session["user"])
    return redirect("/")
 
@app.route("/timer")
def timer():
    if "user" in session:
        return render_template("timer.html", user=session["user"])
    return redirect("/")
 
@app.route("/planner")
def planner():
    if "user" in session:
        return render_template("planner.html", user=session["user"])
    return redirect("/")
 
@app.route("/progress")
def progress():
    if "user" in session:
        return render_template("progress.html", user=session["user"])
    return redirect("/")
 
@app.route("/settings")
def settings():
    if "user" in session:
        conn      = get_db()
        user_info = conn.execute("SELECT * FROM users WHERE username=?", (session["user"],)).fetchone()
        conn.close()
        email = user_info["email"] if user_info else ""
        return render_template("settings.html", user=session["user"], email=email)
    return redirect("/")
 
@app.route("/monitor")
def monitor():
    if "user" in session:
        return redirect("/dashboard")
    return redirect("/")
 
# ── Chat API (Groq via urllib — no groq package needed) ───────────────────────
def _normalize_topic_list(items):
    topics = []
    seen = set()
    for item in items or []:
        if isinstance(item, dict):
            item = item.get("topic") or item.get("text") or item.get("name")
        if not isinstance(item, str):
            continue
        topic = " ".join(item.replace("\u2022", " ").split()).strip(" -•\t")
        if not topic:
            continue
        key = topic.lower()
        if key in seen:
            continue
        seen.add(key)
        topics.append(topic[:120])
    return topics


def _parse_topic_response(content):
    if not content:
        return []
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else ""
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
    candidates = [content]
    if "[" in content and "]" in content:
        candidates.append(content[content.find("["):content.rfind("]") + 1])
    if "{" in content and "}" in content:
        candidates.append(content[content.find("{"):content.rfind("}") + 1])
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except Exception:
            continue
        if isinstance(parsed, list):
            return _normalize_topic_list(parsed)
        if isinstance(parsed, dict):
            for key in ("topics", "items", "syllabus_topics"):
                if key in parsed:
                    return _normalize_topic_list(parsed[key])
    return []


def _fallback_syllabus_topics(text):
    topics = []
    seen = set()
    for raw_line in re.split(r"[\r\n]+", text):
        line = re.sub(r"^\s*(?:[\-*•▪‣–—]|\d+[\)\.\:-]|[A-Za-z][\)\.\:-])\s*", "", raw_line)
        line = re.sub(r"\s+", " ", line).strip()
        if not line or len(line) > 120:
            continue
        lower = line.lower()
        if re.match(r"^(page|table of contents|contents|index|references?|bibliography|appendix|acknowledg\w*)\b", lower):
            continue
        words = line.split()
        if len(words) > 14:
            continue
        keep = False
        if re.match(r"^(chapter|unit|module|lesson|topic|part|section)\b", lower):
            keep = True
        elif re.search(r"\b(chapter|unit|module|lesson|topic|part|section)\s*\d+", lower):
            keep = True
        elif re.match(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,7}$", line) and len(words) <= 8:
            keep = True
        elif re.search(r"[:\-–—]", line) and len(words) <= 12:
            keep = True
        elif line == line.upper() and len(words) <= 10:
            keep = True
        elif len(words) <= 6 and re.match(r'^[A-Za-z][A-Za-z0-9&(),/\'"-]*(\s+[A-Za-z][A-Za-z0-9&(),/\'"-]*)*$', line):
            keep = True
        if not keep:
            continue
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        topics.append(line[:120])
    return topics


@app.route("/api/analyze_syllabus", methods=["POST"])
def analyze_syllabus():
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}
    raw_text = (data.get("text") or "").strip()
    if not raw_text:
        return jsonify({"error": "Empty syllabus text", "topics": []}), 400

    text = "\n".join(line.strip() for line in raw_text.splitlines() if line.strip())[:12000]
    try:
        from groq import Groq

        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=600,
            messages=[
                {"role": "system", "content": "You extract syllabus topics. Return only valid JSON in the form {\"topics\":[...]} with concise study topics, no explanations."},
                {"role": "user", "content": f"Extract the most important study topics from this syllabus or PDF text. Keep 10-30 concise topics, remove boilerplate, duplicates, page numbers, examples, and descriptive sentences. Prioritize headings, unit names, chapter titles, listed topics, and assessment areas. Return only JSON.\n\nSyllabus text:\n{text}"}
            ]
        )
        content = response.choices[0].message.content or ""
        topics = _parse_topic_response(content)
        if not topics:
            topics = _fallback_syllabus_topics(text)
        return jsonify({"topics": topics[:40]})
    except Exception as e:
        return jsonify({"topics": _fallback_syllabus_topics(text)[:40], "warning": str(e)[:120]})


# ── Chat API (Groq via urllib — no groq package needed) ───────────────────────
@app.route("/chat", methods=["POST"])
def chat():
    if "user" not in session:
        return jsonify({"reply": "Please log in first."}), 401
    user_message = request.json.get("message", "").strip()
    if not user_message:
        return jsonify({"reply": "Please type something!"})
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful, friendly study assistant for FocusYou app. Keep replies concise and encouraging."},
                {"role": "user", "content": user_message}
            ]
        )
        return jsonify({"reply": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"reply": f"Error: {str(e)}"})
# ── Chat streaming (for chatbot page) ─────────────────────────────────────────
@app.route("/chat/stream", methods=["POST"])
def chat_stream():
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
 
    import urllib.request, urllib.error
    data    = request.json
    message = data.get("message", "").strip()
    history = data.get("history", [])
    subject = data.get("subject", "")
 
    system = "You are a friendly, expert study tutor in FocusYou. Explain concepts clearly with examples and bullet points. Use emojis occasionally."
    if subject:
        system += f" Student is studying: {subject}."
 
    messages = [{"role": "system", "content": system}] + history[-16:] + [{"role": "user", "content": message}]
 
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7,
        "stream": True
    }).encode("utf-8")
 
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {GROQ_API_KEY}"},
        method="POST"
    )
 
    def generate():
        try:
            with urllib.request.urlopen(req) as resp:
                for raw in resp:
                    line = raw.decode("utf-8").strip()
                    if not line.startswith("data:"): continue
                    chunk = line[5:].strip()
                    if not chunk or chunk == "[DONE]": continue
                    try:
                        obj  = json.loads(chunk)
                        text = obj.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if text:
                            yield f"data: {json.dumps({'text': text})}\n\n"
                    except: pass
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            yield f"data: {json.dumps({'error': body[:200]})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
 
    return Response(stream_with_context(generate()), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
 
# ── Progress APIs ──────────────────────────────────────────────────────────────
@app.route("/api/progress_data")
def progress_data():
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
    user = session["user"]
    conn = get_db()

    sessions_data = conn.execute("SELECT * FROM study_sessions WHERE username=?", (user,)).fetchall()
    conn.close()

    return jsonify({
        "study_sessions": [{"date": s["date"], "duration": s["duration_minutes"]} for s in sessions_data]
    })

@app.route("/api/update_progress", methods=["POST"])
def update_progress():
    return jsonify({"error": "Progress updates for subjects and placement prep have been removed."}), 400
 
@app.route("/api/log_study", methods=["POST"])
def log_study():
    if "user" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data     = request.json
    date     = data.get("date")
    duration = data.get("duration")
    conn = get_db()
    existing = conn.execute("SELECT * FROM study_sessions WHERE username=? AND date=?", (session["user"], date)).fetchone()
    if existing:
        conn.execute("UPDATE study_sessions SET duration_minutes=? WHERE id=?",
                     (existing["duration_minutes"] + duration, existing["id"]))
    else:
        conn.execute("INSERT INTO study_sessions (username, date, duration_minutes) VALUES (?,?,?)",
                     (session["user"], date, duration))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})
 
# ── Focus Monitor (OpenCV) ─────────────────────────────────────────────────────
monitor_state = {
    "running": False, "focused": False, "focus_score": 100,
    "away_seconds": 0, "session_start": None,
    "total_seconds": 0, "focus_seconds": 0,
    "alerts": [], "frame_b64": None,
}
monitor_thread = None
 
def run_monitor():
    import cv2, base64
    cap          = cv2.VideoCapture(0)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    away_start   = None
 
    if not cap.isOpened():
        monitor_state["running"] = False
        monitor_state["alerts"].append({"time": datetime.now().strftime("%H:%M:%S"), "msg": "Camera not found! Check permissions."})
        return
 
    while monitor_state["running"]:
        ret, frame = cap.read()
        if not ret:
            time_module.sleep(0.1)
            continue
 
        gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces   = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
        focused = len(faces) > 0
 
        monitor_state["focused"]       = focused
        monitor_state["total_seconds"] += 1
 
        if focused:
            monitor_state["focus_seconds"] += 1
            away_start = None
            monitor_state["away_seconds"]  = 0
        else:
            if away_start is None:
                away_start = time_module.time()
            monitor_state["away_seconds"] = int(time_module.time() - away_start)
            if monitor_state["away_seconds"] == 30:
                monitor_state["alerts"].append({
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "msg":  "You have been away for 30 seconds!"
                })
                if len(monitor_state["alerts"]) > 10:
                    monitor_state["alerts"].pop(0)
 
        total = monitor_state["total_seconds"]
        monitor_state["focus_score"] = int((monitor_state["focus_seconds"] / total) * 100) if total else 100
 
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (157, 135, 245), 2)
        label = "FOCUSED" if focused else "LOOK AT SCREEN"
        color = (46, 204, 113) if focused else (231, 76, 60)
        cv2.putText(frame, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        cv2.putText(frame, f"Focus: {monitor_state['focus_score']}%", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
 
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
        monitor_state["frame_b64"] = base64.b64encode(buf).decode("utf-8")
        time_module.sleep(1)
 
    cap.release()
    monitor_state["frame_b64"] = None
 
@app.route("/api/monitor/start", methods=["POST"])
def monitor_start():
    global monitor_thread
    if monitor_state["running"]:
        return jsonify({"ok": True, "msg": "Already running"})
    monitor_state.update({
        "running": True, "focused": False, "focus_score": 100,
        "away_seconds": 0, "total_seconds": 0, "focus_seconds": 0,
        "alerts": [], "session_start": datetime.now().strftime("%H:%M:%S"),
        "frame_b64": None
    })
    monitor_thread = threading.Thread(target=run_monitor, daemon=True)
    monitor_thread.start()
    return jsonify({"ok": True})
 
@app.route("/api/monitor/stop", methods=["POST"])
def monitor_stop():
    monitor_state["running"] = False
    return jsonify({
        "ok": True,
        "focus_score":    monitor_state["focus_score"],
        "total_seconds":  monitor_state["total_seconds"],
        "focus_seconds":  monitor_state["focus_seconds"],
    })
 
@app.route("/api/monitor/status")
def monitor_status():
    return jsonify({
        "running":       monitor_state["running"],
        "focused":       monitor_state["focused"],
        "focus_score":   monitor_state["focus_score"],
        "away_seconds":  monitor_state["away_seconds"],
        "total_seconds": monitor_state["total_seconds"],
        "focus_seconds": monitor_state["focus_seconds"],
        "session_start": monitor_state["session_start"],
        "alerts":        monitor_state["alerts"][-3:],
        "frame_b64":     monitor_state["frame_b64"],
    })
 
if __name__ == "__main__":
    app.run(debug=True)
 