import sqlite3

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
DROP TABLE IF EXISTS subjects;
""")

conn.execute("""
DROP TABLE IF EXISTS placement_prep;
""")

conn.execute("""
CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 0
)
""")

print("Database updated successfully!")

conn.close()