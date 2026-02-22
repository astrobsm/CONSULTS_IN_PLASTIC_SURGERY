"""
Fix corrupted foreign key references in SQLite tables.
The fix_schema.py rename-recreate approach left FKs pointing to
"consult_requests_backup" instead of "consult_requests".
Affected tables: consult_reviews, audit_logs, notifications, photos.
"""
import sqlite3, sys

DB_PATH = "ps_consult.db"

# Tables to fix and their correct CREATE statements
FIXES = {
    "consult_reviews": """
CREATE TABLE consult_reviews (
    id INTEGER NOT NULL,
    consult_id INTEGER NOT NULL,
    reviewed_by INTEGER NOT NULL,
    assessment_notes TEXT NOT NULL,
    wound_classification VARCHAR(18),
    wound_phase VARCHAR(13),
    wound_length FLOAT,
    wound_width FLOAT,
    wound_depth FLOAT,
    wound_location VARCHAR(255),
    management_plan TEXT NOT NULL,
    procedure_scheduled BOOLEAN,
    procedure_date DATE,
    procedure_details TEXT,
    follow_up_date DATE,
    follow_up_notes TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY(consult_id) REFERENCES consult_requests (id),
    FOREIGN KEY(reviewed_by) REFERENCES users (id)
)""",
    "audit_logs": """
CREATE TABLE audit_logs (
    id INTEGER NOT NULL,
    user_id INTEGER,
    consult_id INTEGER,
    action VARCHAR(14) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    timestamp DATETIME NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id),
    FOREIGN KEY(consult_id) REFERENCES consult_requests (id)
)""",
    "notifications": """
CREATE TABLE notifications (
    id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    consult_id INTEGER,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN,
    created_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id),
    FOREIGN KEY(consult_id) REFERENCES consult_requests (id)
)""",
    "photos": """
CREATE TABLE photos (
    id INTEGER NOT NULL,
    consult_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    data TEXT NOT NULL,
    description TEXT,
    uploaded_by INTEGER,
    uploaded_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY(consult_id) REFERENCES consult_requests (id),
    FOREIGN KEY(uploaded_by) REFERENCES users (id)
)"""
}

def fix_table(cursor, table_name, new_create_sql):
    backup = f"{table_name}_bak"
    # Get column names
    cursor.execute(f"PRAGMA table_info({table_name})")
    cols = [row[1] for row in cursor.fetchall()]
    col_list = ", ".join(cols)

    sys.stdout.write(f"Fixing {table_name} ({len(cols)} columns)...\n")
    cursor.execute(f"ALTER TABLE {table_name} RENAME TO {backup}")
    cursor.execute(new_create_sql)
    cursor.execute(f"INSERT INTO {table_name} ({col_list}) SELECT {col_list} FROM {backup}")
    cursor.execute(f"DROP TABLE {backup}")
    sys.stdout.write(f"  -> Done\n")

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF")
    cursor = conn.cursor()

    for table_name, create_sql in FIXES.items():
        fix_table(cursor, table_name, create_sql)

    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON")

    # Verify
    sys.stdout.write("\n--- Verification ---\n")
    rows = cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table'").fetchall()
    for name, sql in rows:
        if "consult_requests_backup" in (sql or ""):
            sys.stdout.write(f"STILL BROKEN: {name}\n")
        else:
            sys.stdout.write(f"OK: {name}\n")

    conn.close()
    sys.stdout.write("\nAll tables fixed!\n")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
