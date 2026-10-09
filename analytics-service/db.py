import os
from urllib.parse import unquote

import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url.strip().strip('"')


def connect_postgres():
    url = get_database_url()
    if not url.startswith(("postgresql://", "postgres://")):
        return psycopg2.connect(url)

    rest = url.split("://", 1)[1]
    authority_and_path = rest.split("?", 1)[0]

    at_idx = authority_and_path.rfind("@")
    if at_idx == -1:
        return psycopg2.connect(url)

    userinfo = authority_and_path[:at_idx]
    host_db = authority_and_path[at_idx + 1 :]

    if ":" in userinfo:
        user, password = userinfo.split(":", 1)
    else:
        user, password = userinfo, ""

    if "/" not in host_db:
        raise RuntimeError("DATABASE_URL is missing database name")

    host_port, dbname = host_db.split("/", 1)
    dbname = unquote(dbname)

    if ":" in host_port:
        host, port_str = host_port.rsplit(":", 1)
        port = int(port_str)
    else:
        host, port = host_port, 5432

    return psycopg2.connect(
        host=host,
        port=port,
        user=unquote(user),
        password=unquote(password),
        dbname=dbname,
    )


def check_postgres_connection() -> None:
    conn = connect_postgres()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
    finally:
        conn.close()
