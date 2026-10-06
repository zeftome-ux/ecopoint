"""Banco de dados do EcoPoint: schema, helpers e dados fictícios (seed)."""
import hashlib
import hmac
import os
import random
import secrets
import sqlite3
from datetime import datetime, timedelta, date

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("ECOPOINT_DB", os.path.join(BASE, "ecopoint.db"))
DEFAULT_PASSWORD = "123456"

SCHEMA = """
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    shift TEXT DEFAULT 'Manhã'
);
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','staff','admin')),
    class_id INTEGER REFERENCES classes(id),
    registration TEXT UNIQUE,
    qr_token TEXT UNIQUE,
    avatar_color TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '♻️',
    unit TEXT NOT NULL DEFAULT 'unidade',
    points INTEGER NOT NULL,
    weight_kg REAL NOT NULL DEFAULT 0,
    co2_kg REAL NOT NULL DEFAULT 0,
    water_l REAL NOT NULL DEFAULT 0,
    energy_kwh REAL NOT NULL DEFAULT 0,
    max_per_day INTEGER NOT NULL DEFAULT 20,
    color TEXT NOT NULL DEFAULT '#16a34a',
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    staff_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('approved','pending','rejected')),
    total_points INTEGER NOT NULL,
    total_items INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'qr',
    flag_reason TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_items (
    id INTEGER PRIMARY KEY,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
    material_id INTEGER NOT NULL REFERENCES materials(id),
    quantity INTEGER NOT NULL,
    points INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK (type IN ('delivery','bonus','redemption','refund','adjust')),
    points INTEGER NOT NULL,
    ref_id INTEGER,
    description TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT '🎁',
    category TEXT NOT NULL DEFAULT 'Brinde',
    cost INTEGER NOT NULL,
    stock INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    reward_id INTEGER NOT NULL REFERENCES rewards(id),
    cost INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','delivered','cancelled')),
    handled_by INTEGER REFERENCES users(id),
    handled_at TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT '🎯',
    material_id INTEGER REFERENCES materials(id),
    target INTEGER NOT NULL,
    bonus INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS challenge_completions (
    challenge_id INTEGER NOT NULL REFERENCES challenges(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    completed_at TEXT NOT NULL,
    PRIMARY KEY (challenge_id, user_id)
);
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    metric TEXT NOT NULL,
    threshold INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INTEGER NOT NULL REFERENCES users(id),
    achievement_id INTEGER NOT NULL REFERENCES achievements(id),
    earned_at TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
);
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
    message TEXT NOT NULL,
    student_id INTEGER REFERENCES users(id),
    staff_id INTEGER REFERENCES users(id),
    delivery_id INTEGER REFERENCES deliveries(id),
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL,
    label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_del_student ON deliveries(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_del_staff ON deliveries(staff_id, created_at);
CREATE INDEX IF NOT EXISTS idx_items_del ON delivery_items(delivery_id);
"""

DEFAULT_SETTINGS = [
    ("cooldown_seconds", 60, "Intervalo mínimo entre entregas do mesmo aluno (segundos) — bloqueia duplicidade"),
    ("daily_points_cap", 40, "Pontos por aluno por dia acima dos quais a entrega vai para revisão"),
    ("big_delivery_items", 40, "Quantidade de itens numa única entrega que dispara revisão"),
    ("staff_rate_limit", 20, "Validações de um funcionário em 10 minutos que disparam alerta"),
    ("pair_daily_limit", 3, "Entregas do mesmo par funcionário–aluno por dia antes de revisão"),
    ("max_pending_redemptions", 3, "Resgates pendentes simultâneos permitidos por aluno"),
    ("max_login_attempts", 5, "Tentativas de login erradas antes de bloquear por 5 minutos"),
    ("qr_required", 0, "Exigir QR Code na validação (1 = sim, 0 = permite busca manual)"),
]

LEVELS = [
    (0, "Semente", "🌱"),
    (50, "Broto", "🌿"),
    (150, "Muda", "🍀"),
    (300, "Árvore", "🌳"),
    (600, "Floresta", "🏞️"),
]


def fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def now():
    return fmt(datetime.now())


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${digest}"


def verify_password(password, stored):
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return hmac.compare_digest(check, digest)


def new_qr_token():
    return secrets.token_urlsafe(12)


def init_db():
    conn = connect()
    conn.executescript(SCHEMA)
    for key, value, label in DEFAULT_SETTINGS:
        conn.execute("INSERT OR IGNORE INTO settings(key, value, label) VALUES (?,?,?)", (key, value, label))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Dados fictícios
# ---------------------------------------------------------------------------

FIRST = ["Ana", "Bruno", "Camila", "Daniel", "Eduarda", "Felipe", "Gabriela", "Heitor", "Isabela", "João",
         "Larissa", "Lucas", "Mariana", "Matheus", "Nicole", "Otávio", "Pedro", "Rafaela", "Samuel", "Sofia",
         "Thiago", "Valentina", "Vinícius", "Yasmin", "Arthur", "Beatriz", "Caio", "Davi", "Elisa", "Enzo",
         "Fernanda", "Gustavo", "Helena", "Igor", "Júlia", "Kauã", "Lívia", "Miguel", "Manuela", "Nathan",
         "Olívia", "Paulo", "Rebeca", "Rodrigo", "Sara", "Theo", "Laura", "Vitor"]
LAST = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento",
        "Carvalho", "Gomes", "Martins", "Araújo", "Ribeiro", "Barbosa", "Rocha", "Dias", "Moreira", "Teixeira"]
COLORS = ["#16a34a", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#2563eb", "#ca8a04", "#0d9488", "#9333ea", "#dc2626"]

MATERIALS = [
    # name, icon, unit, points, weight_kg, co2_kg, water_l, energy_kwh, max/day, color
    ("Garrafa PET", "🧴", "garrafa", 1, 0.04, 0.06, 2.5, 0.10, 30, "#0ea5e9"),
    ("Lata de alumínio", "🥫", "lata", 2, 0.015, 0.14, 1.5, 0.21, 30, "#94a3b8"),
    ("Papel", "📄", "maço (~0,5 kg)", 1, 0.5, 0.45, 13.0, 1.25, 10, "#f59e0b"),
    ("Papelão", "📦", "caixa", 3, 0.4, 0.38, 10.0, 1.00, 10, "#a16207"),
    ("Vidro", "🍾", "pote/garrafa", 2, 0.3, 0.09, 0.8, 0.12, 15, "#10b981"),
    ("Óleo de cozinha", "🛢️", "garrafa 500 ml", 4, 0.45, 1.10, 2000.0, 0.30, 4, "#eab308"),
    ("Pilha / bateria", "🔋", "unidade", 3, 0.025, 0.05, 30.0, 0.02, 10, "#ef4444"),
]

REWARDS = [
    ("Lápis ecológico", "Lápis feito de jornal reciclado.", "✏️", "Brinde", 8, 120),
    ("Caderno reciclado", "Caderno de 96 folhas com capa de papelão reciclado.", "📓", "Brinde", 25, 40),
    ("Ecobag EcoPoint", "Sacola reutilizável estampada com o logo do projeto.", "👜", "Brinde", 40, 25),
    ("Garrafa reutilizável", "Garrafa de 500 ml para dizer adeus aos copos descartáveis.", "🥤", "Brinde", 60, 15),
    ("Muda de árvore", "Leve uma muda nativa para plantar em casa.", "🌳", "Brinde", 20, 30),
    ("Escolher a música do intervalo", "Sua playlist toca no intervalo de um dia.", "🎵", "Privilégio", 20, None),
    ("Fura-fila da cantina", "Passe para furar a fila da cantina uma vez.", "🎟️", "Privilégio", 30, None),
    ("Ajudante do professor por um dia", "Auxilie o professor na aula de sua escolha.", "👩‍🏫", "Privilégio", 15, None),
    ("Vale-lanche da cantina", "Um lanche natural + suco na cantina.", "🥪", "Benefício", 35, 50),
    ("Sessão de cinema com pipoca", "Sessão especial de filme na sala de vídeo.", "🎬", "Benefício", 80, 20),
]

ACHIEVEMENTS = [
    ("primeira_entrega", "Primeiro Passo", "Fez sua primeira entrega de recicláveis.", "🌱", "deliveries", 1),
    ("entregas_10", "Reciclador Frequente", "Realizou 10 entregas.", "♻️", "deliveries", 10),
    ("entregas_30", "Eco Constante", "Realizou 30 entregas.", "🏅", "deliveries", 30),
    ("pontos_50", "Estrela Verde", "Acumulou 50 pontos.", "⭐", "earned", 50),
    ("pontos_150", "Super Reciclador", "Acumulou 150 pontos.", "🌟", "earned", 150),
    ("pontos_300", "Lenda da Reciclagem", "Acumulou 300 pontos.", "🏆", "earned", 300),
    ("itens_100", "Cem Itens", "Entregou 100 itens recicláveis.", "💪", "items", 100),
    ("variedade", "Mestre da Separação", "Entregou 5 tipos diferentes de material.", "🌈", "variety", 5),
    ("desafio_1", "Desafiante", "Concluiu um desafio.", "🎯", "challenges", 1),
    ("desafio_3", "Imparável", "Concluiu 3 desafios.", "🔥", "challenges", 3),
    ("primeiro_resgate", "Merecido!", "Trocou pontos por uma recompensa.", "🎁", "redemptions", 1),
]


def seed(force=False):
    """Cria o banco com dados fictícios. Com force=True apaga e recria."""
    if force and os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
    conn = connect()
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
        conn.close()
        return False

    rnd = random.Random(42)
    today = date.today()
    ts_now = now()
    pw = hash_password(DEFAULT_PASSWORD)

    classes = [("6º Ano A", "Manhã"), ("6º Ano B", "Tarde"), ("7º Ano A", "Manhã"),
               ("7º Ano B", "Tarde"), ("8º Ano A", "Manhã"), ("9º Ano A", "Manhã")]
    class_ids = []
    for name, shift in classes:
        class_ids.append(conn.execute("INSERT INTO classes(name, shift) VALUES (?,?)", (name, shift)).lastrowid)

    def add_user(name, email, role, class_id=None, registration=None):
        return conn.execute(
            "INSERT INTO users(name,email,password_hash,role,class_id,registration,qr_token,avatar_color,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (name, email, pw, role, class_id, registration,
             new_qr_token() if role == "student" else None, rnd.choice(COLORS), ts_now)).lastrowid

    admin_id = add_user("Regina Alves (Coordenação)", "admin@ecopoint.com", "admin")
    if os.environ.get("ECOPOINT_ADMIN_PASSWORD"):  # senha própria do admin no site publicado
        conn.execute("UPDATE users SET password_hash=? WHERE id=?",
                     (hash_password(os.environ["ECOPOINT_ADMIN_PASSWORD"]), admin_id))
    staff1 = add_user("Carlos Mendes", "funcionario@ecopoint.com", "staff")
    staff2 = add_user("Patrícia Freitas", "patricia@ecopoint.com", "staff")
    staff_ids = [staff1, staff2]

    students = []
    demo = add_user("Ana Beatriz Souza", "aluno@ecopoint.com", "student", class_ids[2], "2026001")
    students.append((demo, 1.3))
    used = {"Ana Beatriz Souza"}
    reg = 2
    for ci, cid in enumerate(class_ids):
        for _ in range(8 if ci != 2 else 7):
            while True:
                name = f"{rnd.choice(FIRST)} {rnd.choice(LAST)}"
                if name not in used:
                    used.add(name)
                    break
            slug = name.lower()
            for a, b in (("á", "a"), ("â", "a"), ("ã", "a"), ("é", "e"), ("ê", "e"), ("í", "i"),
                         ("ó", "o"), ("ô", "o"), ("ú", "u"), ("ç", "c")):
                slug = slug.replace(a, b)
            email = slug.replace(" ", ".") + "@aluno.ecopoint.com"
            uid = add_user(name, email, "student", cid, f"2026{reg:03d}")
            reg += 1
            class_factor = [0.8, 0.6, 1.1, 0.7, 0.9, 1.0][ci]
            students.append((uid, rnd.uniform(0.15, 1.2) * class_factor))

    mat_ids = []
    for m in MATERIALS:
        mat_ids.append(conn.execute(
            "INSERT INTO materials(name,icon,unit,points,weight_kg,co2_kg,water_l,energy_kwh,max_per_day,color)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)", m).lastrowid)
    mat_points = {mid: MATERIALS[i][3] for i, mid in enumerate(mat_ids)}
    mat_names = {mid: MATERIALS[i][0] for i, mid in enumerate(mat_ids)}
    weights = [30, 22, 18, 12, 8, 2, 3]

    for r in REWARDS:
        conn.execute("INSERT INTO rewards(name,description,icon,category,cost,stock,created_at) VALUES (?,?,?,?,?,?,?)",
                     (*r, ts_now))
    for a in ACHIEVEMENTS:
        conn.execute("INSERT INTO achievements(code,name,description,icon,metric,threshold) VALUES (?,?,?,?,?,?)", a)

    d = lambda n: (today + timedelta(days=n)).isoformat()
    challenges = [
        ("Maratona das Latas", "Entregue 15 latas de alumínio durante o desafio.", "🥫", mat_ids[1], 15, 10, d(-6), d(24)),
        ("Papelão em Ação", "Leve 5 caixas de papelão para a escola.", "📦", mat_ids[3], 5, 8, d(-10), d(12)),
        ("Eco Maratona", "Entregue 60 itens de qualquer material.", "🏃", None, 60, 20, d(-25), d(35)),
        ("Mês Verde", "Entregue 30 itens no mês passado.", "🍃", None, 30, 12, d(-45), d(-16)),
        ("Desafio do Vidro", "Recicle 8 potes ou garrafas de vidro.", "🍾", mat_ids[4], 8, 10, d(4), d(30)),
    ]
    for c in challenges:
        conn.execute("INSERT INTO challenges(title,description,icon,material_id,target,bonus,start_date,end_date)"
                     " VALUES (?,?,?,?,?,?,?,?)", c)

    # Entregas nos últimos 75 dias (apenas dias úteis)
    for uid, activity in students:
        for back in range(75, -1, -1):
            day = today - timedelta(days=back)
            if day.weekday() >= 5:
                continue
            if rnd.random() > 0.22 * activity:
                continue
            when = datetime(day.year, day.month, day.day, rnd.randint(7, 16), rnd.randint(0, 59), rnd.randint(0, 59))
            if when > datetime.now():
                when = datetime.now() - timedelta(minutes=rnd.randint(5, 90))
            n_types = rnd.choice([1, 1, 1, 2, 2, 3])
            chosen = set(rnd.choices(mat_ids, weights=weights, k=n_types))
            items = [(mid, rnd.randint(1, 5) if mat_points[mid] <= 2 else rnd.randint(1, 2)) for mid in chosen]
            total_items = sum(q for _, q in items)
            total_points = sum(q * mat_points[mid] for mid, q in items)
            staff = rnd.choice(staff_ids)
            did = conn.execute(
                "INSERT INTO deliveries(student_id,staff_id,status,total_points,total_items,method,created_at)"
                " VALUES (?,?,?,?,?,?,?)",
                (uid, staff, "approved", total_points, total_items, rnd.choice(["qr", "qr", "qr", "manual"]), fmt(when))).lastrowid
            for mid, q in items:
                conn.execute("INSERT INTO delivery_items(delivery_id,material_id,quantity,points) VALUES (?,?,?,?)",
                             (did, mid, q, q * mat_points[mid]))
            desc = ", ".join(f"{q}× {mat_names[mid]}" for mid, q in items)
            conn.execute("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
                         (uid, "delivery", total_points, did, desc, fmt(when)))

    # Desafios concluídos (retroativo) + bônus
    for ch in conn.execute("SELECT * FROM challenges WHERE start_date <= ?", (today.isoformat(),)).fetchall():
        for uid, _ in students:
            sql = ("SELECT di.quantity, d.created_at FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id"
                   " WHERE d.student_id=? AND d.status='approved' AND substr(d.created_at,1,10) BETWEEN ? AND ?")
            args = [uid, ch["start_date"], ch["end_date"]]
            if ch["material_id"]:
                sql += " AND di.material_id=?"
                args.append(ch["material_id"])
            total = 0
            for row in conn.execute(sql + " ORDER BY d.created_at", args).fetchall():
                total += row["quantity"]
                if total >= ch["target"]:
                    conn.execute("INSERT INTO challenge_completions VALUES (?,?,?)", (ch["id"], uid, row["created_at"]))
                    conn.execute("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
                                 (uid, "bonus", ch["bonus"], ch["id"], f"Desafio concluído: {ch['title']}", row["created_at"]))
                    break

    # Resgates
    reward_rows = conn.execute("SELECT * FROM rewards").fetchall()
    for uid, _ in students:
        balance = conn.execute("SELECT COALESCE(SUM(points),0) FROM transactions WHERE user_id=?", (uid,)).fetchone()[0]
        for _ in range(rnd.randint(0, 2)):
            rw = rnd.choice(reward_rows)
            if rw["cost"] > balance * 0.7:
                continue
            balance -= rw["cost"]
            when = datetime.now() - timedelta(days=rnd.randint(0, 20), hours=rnd.randint(0, 8))
            status = "pending" if rnd.random() < 0.3 else "delivered"
            code = "EP-" + secrets.token_hex(3).upper()
            rid = conn.execute(
                "INSERT INTO redemptions(student_id,reward_id,cost,code,status,handled_by,handled_at,created_at)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (uid, rw["id"], rw["cost"], code, status, staff1 if status == "delivered" else None,
                 fmt(when + timedelta(hours=2)) if status == "delivered" else None, fmt(when))).lastrowid
            conn.execute("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
                         (uid, "redemption", -rw["cost"], rid, f"Resgate: {rw['name']}", fmt(when)))
            if rw["stock"] is not None:
                conn.execute("UPDATE rewards SET stock = stock - 1 WHERE id=?", (rw["id"],))

    # Entregas suspeitas aguardando revisão + alertas antifraude
    suspects = [
        (students[5][0], staff2, [(mat_ids[1], 48)], "Lata de alumínio: 48 un. hoje (limite 30); 48 itens numa única entrega (limite 40)", "high"),
        (students[17][0], staff1, [(mat_ids[3], 12), (mat_ids[5], 6)], "Papelão: 12 un. hoje (limite 10); Óleo de cozinha: 6 un. hoje (limite 4); 60 pontos hoje (limite 40)", "high"),
        (students[30][0], staff2, [(mat_ids[0], 14)], "4ª entrega do mesmo par funcionário–aluno hoje (limite 3)", "medium"),
    ]
    for i, (uid, staff, items, reason, sev) in enumerate(suspects):
        when = datetime.now() - timedelta(hours=i + 1)
        tp = sum(q * mat_points[m] for m, q in items)
        ti = sum(q for _, q in items)
        did = conn.execute(
            "INSERT INTO deliveries(student_id,staff_id,status,total_points,total_items,method,flag_reason,created_at)"
            " VALUES (?,?,?,?,?,?,?,?)", (uid, staff, "pending", tp, ti, "manual", reason, fmt(when))).lastrowid
        for m, q in items:
            conn.execute("INSERT INTO delivery_items(delivery_id,material_id,quantity,points) VALUES (?,?,?,?)",
                         (did, m, q, q * mat_points[m]))
        conn.execute("INSERT INTO fraud_alerts(type,severity,message,student_id,staff_id,delivery_id,created_at)"
                     " VALUES (?,?,?,?,?,?,?)", ("review", sev, reason, uid, staff, did, fmt(when)))
    conn.execute("INSERT INTO fraud_alerts(type,severity,message,student_id,staff_id,created_at) VALUES (?,?,?,?,?,?)",
                 ("duplicate", "low", "Tentativa de entrega duplicada em menos de 60 s (bloqueada).",
                  students[9][0], staff1, fmt(datetime.now() - timedelta(days=1, hours=2))))
    conn.execute("INSERT INTO fraud_alerts(type,severity,message,student_id,created_at) VALUES (?,?,?,?,?)",
                 ("login", "medium", "5 tentativas de login com senha errada — conta bloqueada por 5 min.",
                  students[22][0], fmt(datetime.now() - timedelta(days=2, hours=5))))

    conn.commit()

    # Conquistas retroativas
    ach = conn.execute("SELECT * FROM achievements").fetchall()
    for uid, _ in students:
        m = student_metrics(conn, uid)
        for a in ach:
            if m.get(a["metric"], 0) >= a["threshold"]:
                conn.execute("INSERT OR IGNORE INTO user_achievements VALUES (?,?,?)", (uid, a["id"], ts_now))

    conn.execute("INSERT INTO audit_log(user_id,action,details,created_at) VALUES (?,?,?,?)",
                 (admin_id, "seed", "Banco criado com dados fictícios", ts_now))
    conn.commit()
    conn.close()
    return True


def student_metrics(conn, uid):
    q = lambda sql: conn.execute(sql, (uid,)).fetchone()[0] or 0
    return {
        "deliveries": q("SELECT COUNT(*) FROM deliveries WHERE student_id=? AND status='approved'"),
        "earned": q("SELECT SUM(points) FROM transactions WHERE user_id=? AND type IN ('delivery','bonus')"),
        "items": q("SELECT SUM(di.quantity) FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id"
                   " WHERE d.student_id=? AND d.status='approved'"),
        "variety": q("SELECT COUNT(DISTINCT di.material_id) FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id"
                     " WHERE d.student_id=? AND d.status='approved'"),
        "challenges": q("SELECT COUNT(*) FROM challenge_completions WHERE user_id=?"),
        "redemptions": q("SELECT COUNT(*) FROM redemptions WHERE student_id=? AND status != 'cancelled'"),
    }


if __name__ == "__main__":
    seed(force=True)
    print("Banco recriado com dados fictícios em", DB_PATH)
