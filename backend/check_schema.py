import sqlite3, sys

conn = sqlite3.connect("ps_consult.db")
cursor = conn.cursor()
rows = cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table'").fetchall()
sys.stdout.write(f"Found {len(rows)} tables\n")
for name, sql in rows:
    sys.stdout.write(f"--- {name} ---\n{sql}\n\n")
sys.stdout.flush()
conn.close()
