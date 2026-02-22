"""
Fix SQLite schema: make created_by and uploaded_by nullable
using SQLite's table rebuild approach.
"""
import sqlite3

DB_PATH = "ps_consult.db"


def fix_table(conn, table_name, old_col_def, new_col_def):
    """Fix a column definition in a table by rebuilding it."""
    c = conn.cursor()

    c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    row = c.fetchone()
    if not row:
        print(f"  Table {table_name} not found, skipping")
        return False

    old_sql = row[0]
    if old_col_def not in old_sql:
        print(f"  Column already nullable in {table_name}, skipping")
        return False

    c.execute(f"PRAGMA table_info({table_name})")
    columns = [col[1] for col in c.fetchall()]
    col_list = ", ".join(columns)

    new_sql = old_sql.replace(old_col_def, new_col_def)
    temp_table = f"{table_name}_backup"

    print(f"  Rebuilding {table_name}...")
    c.execute(f"ALTER TABLE {table_name} RENAME TO {temp_table}")
    c.execute(new_sql)
    c.execute(f"INSERT INTO {table_name} ({col_list}) SELECT {col_list} FROM {temp_table}")
    c.execute(f"DROP TABLE {temp_table}")
    conn.commit()
    print(f"  Fixed {table_name} successfully")
    return True


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF")

    print("Fixing consult_requests.created_by -> nullable...")
    fix_table(conn, "consult_requests",
              "created_by INTEGER NOT NULL",
              "created_by INTEGER")

    print("Fixing photos.uploaded_by -> nullable...")
    fix_table(conn, "photos",
              "uploaded_by INTEGER NOT NULL",
              "uploaded_by INTEGER")

    conn.execute("PRAGMA foreign_keys = ON")
    conn.close()
    print("\nDone! Schema fixed.")


if __name__ == "__main__":
    main()
