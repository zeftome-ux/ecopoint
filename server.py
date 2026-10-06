"""EcoPoint — servidor web (apenas biblioteca padrão do Python).

Uso:  python server.py            (porta 8000)
      python server.py --reset    (recria o banco com dados fictícios)
"""
import json
import mimetypes
import os
import re
import secrets
import socket
import sys
import threading
import time
import traceback
from contextlib import nullcontext
from datetime import datetime, timedelta, date
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import db
from db import fmt, now, LEVELS

STATIC = os.path.join(db.BASE, "static")
PORT = int(os.environ.get("PORT", "8000"))
WRITE_LOCK = threading.Lock()
LOGIN_FAILS = {}  # email -> [count, locked_until]

STUDENT, STAFF, ADMIN = ("student",), ("staff", "admin"), ("admin",)
ANY = ("student", "staff", "admin")
ROUTES = []


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def route(method, pattern, roles=None):
    def deco(fn):
        ROUTES.append((method, re.compile("^" + pattern + "$"), roles, fn))
        return fn
    return deco


class Ctx:
    def __init__(self, conn, user, body, query, ip, token):
        self.conn, self.user, self.body, self.query, self.ip, self.token = conn, user, body, query, ip, token

    def q(self, name, default=None):
        v = self.query.get(name)
        return v[0] if v else default

    def one(self, sql, args=()):
        r = self.conn.execute(sql, args).fetchone()
        return dict(r) if r else None

    def all(self, sql, args=()):
        return [dict(r) for r in self.conn.execute(sql, args).fetchall()]

    def val(self, sql, args=()):
        r = self.conn.execute(sql, args).fetchone()
        return r[0] if r and r[0] is not None else 0

    def run(self, sql, args=()):
        return self.conn.execute(sql, args)

    def audit(self, action, details=""):
        self.run("INSERT INTO audit_log(user_id,action,details,ip,created_at) VALUES (?,?,?,?,?)",
                 (self.user["id"] if self.user else None, action, details, self.ip, now()))


# ---------------------------------------------------------------------------
# Helpers de negócio
# ---------------------------------------------------------------------------

def settings(ctx):
    return {r["key"]: r["value"] for r in ctx.all("SELECT key, value FROM settings")}


def balance(ctx, uid):
    return ctx.val("SELECT SUM(points) FROM transactions WHERE user_id=?", (uid,))


def earned(ctx, uid, since=None):
    sql = "SELECT SUM(points) FROM transactions WHERE user_id=? AND type IN ('delivery','bonus')"
    args = [uid]
    if since:
        sql += " AND created_at >= ?"
        args.append(since)
    return ctx.val(sql, args)


def level_info(points):
    cur = LEVELS[0]
    nxt = None
    for i, lv in enumerate(LEVELS):
        if points >= lv[0]:
            cur = lv
            nxt = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
    progress = 100 if not nxt else round((points - cur[0]) * 100 / (nxt[0] - cur[0]))
    return {"name": cur[1], "icon": cur[2], "min": cur[0], "next_name": nxt[1] if nxt else None,
            "next_min": nxt[0] if nxt else None, "progress": progress}


def impact(ctx, student_id=None, since=None, class_id=None):
    sql = ("SELECT COALESCE(SUM(di.quantity),0) items, COALESCE(SUM(di.quantity*m.weight_kg),0) kg,"
           " COALESCE(SUM(di.quantity*m.co2_kg),0) co2, COALESCE(SUM(di.quantity*m.water_l),0) water,"
           " COALESCE(SUM(di.quantity*m.energy_kwh),0) energy"
           " FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id JOIN materials m ON m.id=di.material_id"
           " JOIN users u ON u.id=d.student_id WHERE d.status='approved'")
    args = []
    if student_id:
        sql += " AND d.student_id=?"
        args.append(student_id)
    if class_id:
        sql += " AND u.class_id=?"
        args.append(class_id)
    if since:
        sql += " AND d.created_at >= ?"
        args.append(since)
    r = ctx.one(sql, args)
    r["trees"] = r["co2"] / 22.0  # uma árvore absorve ~22 kg de CO2 por ano
    return {k: round(v, 2) for k, v in r.items()}


def month_start():
    return date.today().replace(day=1).isoformat() + " 00:00:00"


def days_ago(n):
    return (date.today() - timedelta(days=n)).isoformat() + " 00:00:00"


def period_since(period):
    return {"month": month_start(), "30d": days_ago(29), "7d": days_ago(6)}.get(period)


def challenge_progress(ctx, ch, uid):
    sql = ("SELECT SUM(di.quantity) FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id"
           " WHERE d.student_id=? AND d.status='approved' AND substr(d.created_at,1,10) BETWEEN ? AND ?")
    args = [uid, ch["start_date"], ch["end_date"]]
    if ch["material_id"]:
        sql += " AND di.material_id=?"
        args.append(ch["material_id"])
    return ctx.val(sql, args)


def evaluate_rewards(ctx, uid):
    """Confere desafios concluídos e conquistas novas para o aluno."""
    ts = now()
    today = date.today().isoformat()
    completed = []
    chs = ctx.all("SELECT * FROM challenges WHERE active=1 AND start_date<=? AND end_date>=? AND id NOT IN"
                  " (SELECT challenge_id FROM challenge_completions WHERE user_id=?)", (today, today, uid))
    for ch in chs:
        if challenge_progress(ctx, ch, uid) >= ch["target"]:
            ctx.run("INSERT INTO challenge_completions VALUES (?,?,?)", (ch["id"], uid, ts))
            ctx.run("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
                    (uid, "bonus", ch["bonus"], ch["id"], f"Desafio concluído: {ch['title']}", ts))
            completed.append({"title": ch["title"], "icon": ch["icon"], "bonus": ch["bonus"]})
    metrics = db.student_metrics(ctx.conn, uid)
    new_ach = []
    for a in ctx.all("SELECT * FROM achievements WHERE id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id=?)", (uid,)):
        if metrics.get(a["metric"], 0) >= a["threshold"]:
            ctx.run("INSERT INTO user_achievements VALUES (?,?,?)", (uid, a["id"], ts))
            new_ach.append({"name": a["name"], "icon": a["icon"]})
    return completed, new_ach


def public_user(u):
    return {k: u[k] for k in ("id", "name", "email", "role", "class_id", "registration", "avatar_color")}


def require(cond, msg, status=400):
    if not cond:
        raise ApiError(status, msg)


def to_int(v, name, lo=None, hi=None):
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ApiError(400, f"Valor inválido para {name}.")
    if lo is not None and n < lo or hi is not None and n > hi:
        raise ApiError(400, f"{name} deve estar entre {lo} e {hi}.")
    return n


def to_float(v, name):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        raise ApiError(400, f"Valor inválido para {name}.")


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------

@route("POST", "/api/login")
def login(ctx):
    email = str(ctx.body.get("email", "")).strip().lower()
    password = str(ctx.body.get("password", ""))
    require(email and password, "Informe e-mail (ou matrícula) e senha.")
    st = settings(ctx)
    fails = LOGIN_FAILS.get(email)
    if fails and fails[1] > time.time():
        raise ApiError(429, f"Muitas tentativas. Tente novamente em {int(fails[1] - time.time()) // 60 + 1} min.")
    u = ctx.one("SELECT * FROM users WHERE lower(email)=? OR registration=?", (email, email))
    if not u or not db.verify_password(password, u["password_hash"]):
        count = (fails[0] if fails else 0) + 1
        locked = 0
        if count >= st["max_login_attempts"]:
            locked = time.time() + 300
            ctx.run("INSERT INTO fraud_alerts(type,severity,message,student_id,created_at) VALUES (?,?,?,?,?)",
                    ("login", "medium", f"{count} tentativas de login com senha errada para '{email}' — bloqueado por 5 min.",
                     u["id"] if u and u["role"] == "student" else None, now()))
            count = 0
        LOGIN_FAILS[email] = [count, locked]
        ctx.conn.commit()
        raise ApiError(401, "E-mail/matrícula ou senha incorretos.")
    require(u["active"], "Usuário desativado. Procure a coordenação.", 403)
    LOGIN_FAILS.pop(email, None)
    token = secrets.token_urlsafe(32)
    ctx.run("INSERT INTO sessions VALUES (?,?,?,?)", (token, u["id"], fmt(datetime.now() + timedelta(days=7)), now()))
    ctx.user = u
    ctx.audit("login", u["email"])
    return {"token": token, "user": public_user(u)}


@route("POST", "/api/logout", ANY)
def logout(ctx):
    ctx.run("DELETE FROM sessions WHERE token=?", (ctx.token,))
    return {"ok": True}


@route("GET", "/api/me", ANY)
def me(ctx):
    u = public_user(ctx.user)
    if u["class_id"]:
        u["class_name"] = ctx.val("SELECT name FROM classes WHERE id=?", (u["class_id"],))
    return {"user": u}


# ---------------------------------------------------------------------------
# Aluno
# ---------------------------------------------------------------------------

def ranking_rows(ctx, since=None, class_id=None, limit=None):
    sql = ("SELECT u.id, u.name, u.avatar_color, c.name class_name, u.class_id, COALESCE(SUM(t.points),0) points"
           " FROM users u LEFT JOIN classes c ON c.id=u.class_id"
           " LEFT JOIN transactions t ON t.user_id=u.id AND t.type IN ('delivery','bonus')"
           + (" AND t.created_at >= ?" if since else "") +
           " WHERE u.role='student' AND u.active=1" + (" AND u.class_id=?" if class_id else "") +
           " GROUP BY u.id ORDER BY points DESC, u.name")
    args = ([since] if since else []) + ([class_id] if class_id else [])
    if limit:
        sql += f" LIMIT {int(limit)}"
    return ctx.all(sql, args)


@route("GET", "/api/student/dashboard", STUDENT)
def student_dashboard(ctx):
    uid = ctx.user["id"]
    total = earned(ctx, uid)
    month = earned(ctx, uid, days_ago(29))
    rank = ranking_rows(ctx)
    pos = next((i + 1 for i, r in enumerate(rank) if r["id"] == uid), None)
    class_rank = class_ranking(ctx)
    cpos = next((i + 1 for i, r in enumerate(class_rank) if r["id"] == ctx.user["class_id"]), None)
    # série dos últimos 14 dias
    start = date.today() - timedelta(days=13)
    by_day = {r["d"]: r for r in ctx.all(
        "SELECT substr(created_at,1,10) d, SUM(points) pts FROM transactions WHERE user_id=? AND type IN ('delivery','bonus')"
        " AND created_at >= ? GROUP BY d", (uid, start.isoformat()))}
    series = []
    for i in range(14):
        dd = (start + timedelta(days=i)).isoformat()
        series.append({"date": dd, "value": by_day.get(dd, {}).get("pts", 0)})
    materials = ctx.all(
        "SELECT m.name, m.icon, m.color, SUM(di.quantity) qty, SUM(di.points) pts FROM delivery_items di"
        " JOIN deliveries d ON d.id=di.delivery_id JOIN materials m ON m.id=di.material_id"
        " WHERE d.student_id=? AND d.status='approved' GROUP BY m.id ORDER BY qty DESC", (uid,))
    recent = ctx.all("SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 6", (uid,))
    today = date.today().isoformat()
    chs = ctx.all("SELECT ch.*, m.name material_name FROM challenges ch LEFT JOIN materials m ON m.id=ch.material_id"
                  " WHERE ch.active=1 AND ch.start_date<=? AND ch.end_date>=? ORDER BY ch.end_date", (today, today))
    for ch in chs:
        ch["progress"] = challenge_progress(ctx, ch, uid)
        ch["completed"] = bool(ctx.val("SELECT 1 FROM challenge_completions WHERE challenge_id=? AND user_id=?", (ch["id"], uid)))
    ach = ctx.all("SELECT a.name, a.icon, ua.earned_at FROM user_achievements ua JOIN achievements a ON a.id=ua.achievement_id"
                  " WHERE ua.user_id=? ORDER BY ua.earned_at DESC, a.threshold DESC LIMIT 4", (uid,))
    return {
        "balance": balance(ctx, uid), "earned": total, "month": month, "level": level_info(total),
        "rank": pos, "rank_total": len(rank), "class_rank": cpos, "class_total": len(class_rank),
        "class_name": ctx.val("SELECT name FROM classes WHERE id=?", (ctx.user["class_id"],)),
        "impact": impact(ctx, student_id=uid), "series": series, "materials": materials, "recent": recent,
        "challenges": chs, "achievements": ach,
        "achievements_count": ctx.val("SELECT COUNT(*) FROM user_achievements WHERE user_id=?", (uid,)),
        "achievements_total": ctx.val("SELECT COUNT(*) FROM achievements"),
    }


@route("GET", "/api/student/history", STUDENT)
def student_history(ctx):
    uid = ctx.user["id"]
    deliveries = ctx.all(
        "SELECT d.*, s.name staff_name FROM deliveries d JOIN users s ON s.id=d.staff_id"
        " WHERE d.student_id=? ORDER BY d.created_at DESC LIMIT 200", (uid,))
    ids = [d["id"] for d in deliveries]
    items = {}
    if ids:
        for it in ctx.all(f"SELECT di.*, m.name, m.icon FROM delivery_items di JOIN materials m ON m.id=di.material_id"
                          f" WHERE di.delivery_id IN ({','.join('?' * len(ids))})", ids):
            items.setdefault(it["delivery_id"], []).append(it)
    for d in deliveries:
        d["items"] = items.get(d["id"], [])
    tx = ctx.all("SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 300", (uid,))
    return {"deliveries": deliveries, "transactions": tx, "balance": balance(ctx, uid)}


@route("GET", "/api/student/qr", STUDENT)
def student_qr(ctx):
    u = ctx.user
    return {"qr_payload": f"ECOPOINT:{u['qr_token']}", "registration": u["registration"], "name": u["name"],
            "class_name": ctx.val("SELECT name FROM classes WHERE id=?", (u["class_id"],))}


@route("GET", "/api/rewards", ANY)
def list_rewards(ctx):
    rows = ctx.all("SELECT * FROM rewards WHERE active=1 ORDER BY cost")
    out = {"rewards": rows}
    if ctx.user["role"] == "student":
        out["balance"] = balance(ctx, ctx.user["id"])
        out["redemptions"] = ctx.all(
            "SELECT r.*, rw.name, rw.icon FROM redemptions r JOIN rewards rw ON rw.id=r.reward_id"
            " WHERE r.student_id=? ORDER BY r.created_at DESC", (ctx.user["id"],))
    return out


@route("POST", r"/api/rewards/(\d+)/redeem", STUDENT)
def redeem(ctx, rid):
    uid = ctx.user["id"]
    rw = ctx.one("SELECT * FROM rewards WHERE id=? AND active=1", (rid,))
    require(rw, "Recompensa não encontrada.", 404)
    require(rw["stock"] is None or rw["stock"] > 0, "Esta recompensa está esgotada.")
    bal = balance(ctx, uid)
    require(bal >= rw["cost"], f"Saldo insuficiente: você tem {bal} pts e precisa de {rw['cost']} pts.")
    st = settings(ctx)
    pending = ctx.val("SELECT COUNT(*) FROM redemptions WHERE student_id=? AND status='pending'", (uid,))
    require(pending < st["max_pending_redemptions"],
            f"Você já tem {pending} resgates aguardando retirada. Retire-os antes de pedir outro.")
    code = "EP-" + secrets.token_hex(3).upper()
    ts = now()
    red_id = ctx.run("INSERT INTO redemptions(student_id,reward_id,cost,code,status,created_at) VALUES (?,?,?,?,?,?)",
                     (uid, rw["id"], rw["cost"], code, "pending", ts)).lastrowid
    ctx.run("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
            (uid, "redemption", -rw["cost"], red_id, f"Resgate: {rw['name']}", ts))
    if rw["stock"] is not None:
        ctx.run("UPDATE rewards SET stock=stock-1 WHERE id=?", (rw["id"],))
    _, new_ach = evaluate_rewards(ctx, uid)
    ctx.audit("redeem", f"{rw['name']} ({code})")
    return {"code": code, "balance": balance(ctx, uid), "achievements": new_ach}


@route("POST", r"/api/student/redemptions/(\d+)/cancel", STUDENT)
def student_cancel_redemption(ctx, rid):
    r = ctx.one("SELECT * FROM redemptions WHERE id=? AND student_id=?", (rid, ctx.user["id"]))
    require(r, "Resgate não encontrado.", 404)
    cancel_redemption(ctx, r)
    return {"ok": True}


def cancel_redemption(ctx, r):
    require(r["status"] == "pending", "Só é possível cancelar resgates pendentes.")
    ts = now()
    ctx.run("UPDATE redemptions SET status='cancelled', handled_by=?, handled_at=? WHERE id=?", (ctx.user["id"], ts, r["id"]))
    ctx.run("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
            (r["student_id"], "refund", r["cost"], r["id"], f"Estorno do resgate {r['code']}", ts))
    ctx.run("UPDATE rewards SET stock=stock+1 WHERE id=? AND stock IS NOT NULL", (r["reward_id"],))
    ctx.audit("redemption_cancel", r["code"])


@route("GET", "/api/challenges", ANY)
def list_challenges(ctx):
    rows = ctx.all("SELECT ch.*, m.name material_name, m.icon material_icon FROM challenges ch"
                   " LEFT JOIN materials m ON m.id=ch.material_id WHERE ch.active=1 ORDER BY ch.end_date DESC")
    today = date.today().isoformat()
    for ch in rows:
        ch["state"] = "upcoming" if ch["start_date"] > today else ("ended" if ch["end_date"] < today else "active")
        ch["completions"] = ctx.val("SELECT COUNT(*) FROM challenge_completions WHERE challenge_id=?", (ch["id"],))
        if ctx.user["role"] == "student":
            ch["progress"] = challenge_progress(ctx, ch, ctx.user["id"])
            ch["completed"] = bool(ctx.val("SELECT 1 FROM challenge_completions WHERE challenge_id=? AND user_id=?",
                                           (ch["id"], ctx.user["id"])))
    out = {"challenges": rows}
    if ctx.user["role"] == "student":
        out["achievements"] = ctx.all(
            "SELECT a.*, ua.earned_at FROM achievements a LEFT JOIN user_achievements ua"
            " ON ua.achievement_id=a.id AND ua.user_id=? ORDER BY ua.earned_at IS NULL, a.metric, a.threshold",
            (ctx.user["id"],))
        out["metrics"] = db.student_metrics(ctx.conn, ctx.user["id"])
    return out


# ---------------------------------------------------------------------------
# Ranking e dados públicos
# ---------------------------------------------------------------------------

def class_ranking(ctx, since=None):
    rows = ctx.all("SELECT c.id, c.name, c.shift, COUNT(DISTINCT u.id) students FROM classes c"
                   " LEFT JOIN users u ON u.class_id=c.id AND u.role='student' AND u.active=1 GROUP BY c.id")
    for c in rows:
        c["points"] = ctx.val("SELECT SUM(t.points) FROM transactions t JOIN users u ON u.id=t.user_id"
                              " WHERE u.class_id=? AND u.active=1 AND t.type IN ('delivery','bonus')"
                              + (" AND t.created_at >= ?" if since else ""), [c["id"]] + ([since] if since else []))
        c["items"] = impact(ctx, class_id=c["id"], since=since)["items"]
        c["average"] = round(c["points"] / c["students"], 1) if c["students"] else 0
    rows.sort(key=lambda c: (-c["points"], c["name"]))
    return rows


@route("GET", "/api/ranking", ANY)
def ranking(ctx):
    since = period_since(ctx.q("period", "30d"))
    class_id = ctx.q("class_id")
    students = ranking_rows(ctx, since, int(class_id) if class_id else None, limit=100)
    for s in students:
        s["level"] = level_info(earned(ctx, s["id"]))["icon"]
    return {"students": students, "classes": class_ranking(ctx, since),
            "class_list": ctx.all("SELECT id, name FROM classes ORDER BY name")}


@route("GET", "/api/materials", ANY)
def list_materials(ctx):
    sql = "SELECT * FROM materials" + ("" if ctx.user["role"] == "admin" else " WHERE active=1") + " ORDER BY active DESC, id"
    return {"materials": ctx.all(sql)}


@route("GET", "/api/classes", ANY)
def list_classes(ctx):
    return {"classes": ctx.all("SELECT * FROM classes ORDER BY name")}


# ---------------------------------------------------------------------------
# Funcionário: validação de entregas e resgates
# ---------------------------------------------------------------------------

def student_card(ctx, s):
    today = date.today().isoformat()
    return {
        "id": s["id"], "name": s["name"], "registration": s["registration"], "avatar_color": s["avatar_color"],
        "class_name": ctx.val("SELECT name FROM classes WHERE id=?", (s["class_id"],)), "active": s["active"],
        "balance": balance(ctx, s["id"]),
        "today_points": ctx.val("SELECT SUM(total_points) FROM deliveries WHERE student_id=? AND status!='rejected'"
                                " AND substr(created_at,1,10)=?", (s["id"], today)),
        "today_deliveries": ctx.val("SELECT COUNT(*) FROM deliveries WHERE student_id=? AND status!='rejected'"
                                    " AND substr(created_at,1,10)=?", (s["id"], today)),
    }


@route("GET", "/api/staff/lookup", STAFF)
def staff_lookup(ctx):
    code = (ctx.q("code") or "").strip()
    require(code, "Informe o QR Code ou a matrícula.")
    if code.upper().startswith("ECOPOINT:"):
        s = ctx.one("SELECT * FROM users WHERE qr_token=? AND role='student'", (code[9:],))
        require(s, "QR Code inválido ou expirado. Peça ao aluno para atualizar o QR.", 404)
        return {"student": student_card(ctx, s), "method": "qr", "qr_token": code[9:]}
    require(not settings(ctx)["qr_required"], "A escola exige leitura do QR Code para validar entregas.", 403)
    s = ctx.one("SELECT * FROM users WHERE role='student' AND (registration=? OR lower(email)=?)", (code, code.lower()))
    if s:
        return {"student": student_card(ctx, s), "method": "manual"}
    matches = ctx.all("SELECT * FROM users WHERE role='student' AND active=1 AND name LIKE ? ORDER BY name LIMIT 8",
                      (f"%{code}%",))
    require(matches, "Nenhum aluno encontrado.", 404)
    if len(matches) == 1:
        return {"student": student_card(ctx, matches[0]), "method": "manual"}
    return {"matches": [student_card(ctx, m) for m in matches]}


def add_alert(ctx, type_, severity, message, student_id=None, staff_id=None, delivery_id=None):
    ctx.run("INSERT INTO fraud_alerts(type,severity,message,student_id,staff_id,delivery_id,created_at) VALUES (?,?,?,?,?,?,?)",
            (type_, severity, message, student_id, staff_id, delivery_id, now()))


@route("POST", "/api/staff/deliveries", STAFF)
def create_delivery(ctx):
    b = ctx.body
    staff_id = ctx.user["id"]
    s = ctx.one("SELECT * FROM users WHERE id=? AND role='student'", (to_int(b.get("student_id"), "aluno"),))
    require(s, "Aluno não encontrado.", 404)
    require(s["active"], "Este aluno está desativado.")
    st = settings(ctx)
    method = "qr" if b.get("method") == "qr" else "manual"
    if method == "qr":
        require(b.get("qr_token") == s["qr_token"], "QR Code não confere com o aluno. Leia o QR novamente.")
    else:
        require(not st["qr_required"], "A escola exige leitura do QR Code para validar entregas.", 403)

    # Itens
    raw = b.get("items") or []
    require(isinstance(raw, list) and raw, "Adicione pelo menos um material.")
    qty = {}
    for it in raw:
        mid = to_int(it.get("material_id"), "material")
        q = to_int(it.get("quantity"), "quantidade", 0, 500)
        if q:
            qty[mid] = qty.get(mid, 0) + q
    require(qty, "Adicione pelo menos um material.")
    mats = {}
    for mid in qty:
        m = ctx.one("SELECT * FROM materials WHERE id=? AND active=1", (mid,))
        require(m, "Material inválido ou desativado.")
        mats[mid] = m

    nowdt = datetime.now()
    ts = fmt(nowdt)
    today = nowdt.date().isoformat()

    # 1) Bloqueio de duplicidade
    last = ctx.val("SELECT MAX(created_at) FROM deliveries WHERE student_id=? AND status!='rejected'", (s["id"],))
    if last:
        elapsed = (nowdt - datetime.strptime(last, "%Y-%m-%d %H:%M:%S")).total_seconds()
        if elapsed < st["cooldown_seconds"]:
            add_alert(ctx, "duplicate", "low",
                      f"Tentativa de entrega duplicada para {s['name']} {int(elapsed)} s após a anterior (bloqueada).",
                      s["id"], staff_id)
            ctx.audit("delivery_blocked", f"duplicidade aluno={s['id']}")
            ctx.conn.commit()
            raise ApiError(429, f"Entrega bloqueada: este aluno já entregou há {int(elapsed)} s. "
                                f"Aguarde {st['cooldown_seconds'] - int(elapsed)} s (proteção contra duplicidade).")

    # 2) Regras de revisão
    flags = []
    for mid, q in qty.items():
        before = ctx.val("SELECT SUM(di.quantity) FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id"
                         " WHERE d.student_id=? AND di.material_id=? AND d.status!='rejected' AND substr(d.created_at,1,10)=?",
                         (s["id"], mid, today))
        if before + q > mats[mid]["max_per_day"]:
            flags.append(f"{mats[mid]['name']}: {before + q} un. hoje (limite {mats[mid]['max_per_day']})")
    total_items = sum(qty.values())
    total_points = sum(q * mats[mid]["points"] for mid, q in qty.items())
    today_pts = ctx.val("SELECT SUM(total_points) FROM deliveries WHERE student_id=? AND status!='rejected'"
                        " AND substr(created_at,1,10)=?", (s["id"], today))
    if today_pts + total_points > st["daily_points_cap"]:
        flags.append(f"{today_pts + total_points} pontos hoje (limite {st['daily_points_cap']})")
    if total_items > st["big_delivery_items"]:
        flags.append(f"{total_items} itens numa única entrega (limite {st['big_delivery_items']})")
    recent_staff = ctx.val("SELECT COUNT(*) FROM deliveries WHERE staff_id=? AND created_at >= ?",
                           (staff_id, fmt(nowdt - timedelta(minutes=10))))
    if recent_staff >= st["staff_rate_limit"]:
        flags.append(f"Funcionário com {recent_staff + 1} validações em 10 min (limite {st['staff_rate_limit']})")
    pair = ctx.val("SELECT COUNT(*) FROM deliveries WHERE staff_id=? AND student_id=? AND status!='rejected'"
                   " AND substr(created_at,1,10)=?", (staff_id, s["id"], today))
    if pair >= st["pair_daily_limit"]:
        flags.append(f"{pair + 1}ª entrega do mesmo par funcionário–aluno hoje (limite {st['pair_daily_limit']})")

    status = "pending" if flags else "approved"
    reason = "; ".join(flags) or None
    did = ctx.run("INSERT INTO deliveries(student_id,staff_id,status,total_points,total_items,method,flag_reason,created_at)"
                  " VALUES (?,?,?,?,?,?,?,?)", (s["id"], staff_id, status, total_points, total_items, method, reason, ts)).lastrowid
    for mid, q in qty.items():
        ctx.run("INSERT INTO delivery_items(delivery_id,material_id,quantity,points) VALUES (?,?,?,?)",
                (did, mid, q, q * mats[mid]["points"]))
    completed, new_ach = [], []
    desc = ", ".join(f"{q}× {mats[mid]['name']}" for mid, q in qty.items())
    if status == "approved":
        ctx.run("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
                (s["id"], "delivery", total_points, did, desc, ts))
        completed, new_ach = evaluate_rewards(ctx, s["id"])
    else:
        add_alert(ctx, "review", "high" if len(flags) > 1 else "medium", reason, s["id"], staff_id, did)
    ctx.audit("delivery", f"#{did} aluno={s['name']} {desc} = {total_points} pts [{status}] via {method}")
    return {"id": did, "status": status, "points": total_points, "items": total_items, "flags": flags,
            "challenges": completed, "achievements": new_ach, "balance": balance(ctx, s["id"]), "student": s["name"]}


@route("GET", "/api/staff/deliveries", STAFF)
def staff_deliveries(ctx):
    day = ctx.q("date") or date.today().isoformat()
    sql = ("SELECT d.*, u.name student_name, u.registration, c.name class_name, s.name staff_name FROM deliveries d"
           " JOIN users u ON u.id=d.student_id LEFT JOIN classes c ON c.id=u.class_id JOIN users s ON s.id=d.staff_id"
           " WHERE substr(d.created_at,1,10)=?")
    args = [day]
    if ctx.user["role"] == "staff" and ctx.q("mine", "1") == "1":
        sql += " AND d.staff_id=?"
        args.append(ctx.user["id"])
    rows = ctx.all(sql + " ORDER BY d.created_at DESC", args)
    for r in rows:
        r["items"] = ctx.all("SELECT di.quantity, m.name, m.icon FROM delivery_items di JOIN materials m ON m.id=di.material_id"
                             " WHERE di.delivery_id=?", (r["id"],))
    summary = {
        "count": len(rows),
        "items": sum(r["total_items"] for r in rows if r["status"] == "approved"),
        "points": sum(r["total_points"] for r in rows if r["status"] == "approved"),
        "pending": sum(1 for r in rows if r["status"] == "pending"),
    }
    return {"deliveries": rows, "summary": summary, "date": day}


@route("GET", "/api/staff/redemptions", STAFF)
def staff_redemptions(ctx):
    status = ctx.q("status", "pending")
    code = (ctx.q("code") or "").strip().upper()
    sql = ("SELECT r.*, rw.name reward_name, rw.icon, u.name student_name, u.registration, c.name class_name,"
           " h.name handled_by_name FROM redemptions r JOIN rewards rw ON rw.id=r.reward_id JOIN users u ON u.id=r.student_id"
           " LEFT JOIN classes c ON c.id=u.class_id LEFT JOIN users h ON h.id=r.handled_by WHERE 1=1")
    args = []
    if code:
        sql += " AND r.code LIKE ?"
        args.append(f"%{code}%")
    elif status != "all":
        sql += " AND r.status=?"
        args.append(status)
    return {"redemptions": ctx.all(sql + " ORDER BY r.created_at DESC LIMIT 200", args)}


@route("POST", r"/api/staff/redemptions/(\d+)/deliver", STAFF)
def deliver_redemption(ctx, rid):
    r = ctx.one("SELECT * FROM redemptions WHERE id=?", (rid,))
    require(r, "Resgate não encontrado.", 404)
    require(r["status"] == "pending", "Este resgate já foi processado.")
    ctx.run("UPDATE redemptions SET status='delivered', handled_by=?, handled_at=? WHERE id=?", (ctx.user["id"], now(), rid))
    ctx.audit("redemption_deliver", r["code"])
    return {"ok": True}


@route("POST", r"/api/staff/redemptions/(\d+)/cancel", STAFF)
def staff_cancel_redemption(ctx, rid):
    r = ctx.one("SELECT * FROM redemptions WHERE id=?", (rid,))
    require(r, "Resgate não encontrado.", 404)
    cancel_redemption(ctx, r)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Administração
# ---------------------------------------------------------------------------

@route("GET", "/api/admin/overview", ADMIN)
def admin_overview(ctx):
    ms = days_ago(29)
    prev_start = days_ago(59)
    total_imp = impact(ctx)
    month_imp = impact(ctx, since=ms)
    prev_items = ctx.val("SELECT SUM(di.quantity) FROM delivery_items di JOIN deliveries d ON d.id=di.delivery_id"
                         " WHERE d.status='approved' AND d.created_at >= ? AND d.created_at < ?", (prev_start, ms))
    start = date.today() - timedelta(days=29)
    by_day = {r["d"]: r for r in ctx.all(
        "SELECT substr(d.created_at,1,10) d, SUM(d.total_items) items, SUM(d.total_points) pts FROM deliveries d"
        " WHERE d.status='approved' AND d.created_at >= ? GROUP BY 1", (start.isoformat(),))}
    series = [{"date": (start + timedelta(days=i)).isoformat(),
               "value": by_day.get((start + timedelta(days=i)).isoformat(), {}).get("items", 0)} for i in range(30)]
    materials = ctx.all(
        "SELECT m.id, m.name, m.icon, m.color, COALESCE(SUM(di.quantity),0) qty, COALESCE(SUM(di.points),0) pts,"
        " COALESCE(SUM(di.quantity*m.weight_kg),0) kg FROM materials m LEFT JOIN delivery_items di ON di.material_id=m.id"
        " AND di.delivery_id IN (SELECT id FROM deliveries WHERE status='approved') GROUP BY m.id ORDER BY qty DESC")
    rewards = ctx.all("SELECT rw.name, rw.icon, COUNT(r.id) qty FROM rewards rw JOIN redemptions r ON r.reward_id=rw.id"
                      " AND r.status!='cancelled' GROUP BY rw.id ORDER BY qty DESC LIMIT 5")
    recent = ctx.all("SELECT d.id, d.created_at, d.total_points, d.total_items, d.status, u.name student_name,"
                     " s.name staff_name FROM deliveries d JOIN users u ON u.id=d.student_id JOIN users s ON s.id=d.staff_id"
                     " ORDER BY d.created_at DESC LIMIT 8")
    return {
        "students": ctx.val("SELECT COUNT(*) FROM users WHERE role='student' AND active=1"),
        "active_students_month": ctx.val("SELECT COUNT(DISTINCT student_id) FROM deliveries WHERE status='approved' AND created_at >= ?", (ms,)),
        "deliveries": ctx.val("SELECT COUNT(*) FROM deliveries WHERE status='approved'"),
        "points_distributed": ctx.val("SELECT SUM(points) FROM transactions WHERE type IN ('delivery','bonus')"),
        "points_redeemed": -ctx.val("SELECT SUM(points) FROM transactions WHERE type IN ('redemption','refund')"),
        "redemptions_pending": ctx.val("SELECT COUNT(*) FROM redemptions WHERE status='pending'"),
        "pending_reviews": ctx.val("SELECT COUNT(*) FROM deliveries WHERE status='pending'"),
        "open_alerts": ctx.val("SELECT COUNT(*) FROM fraud_alerts WHERE resolved=0"),
        "impact": total_imp, "month_impact": month_imp, "prev_month_items": prev_items,
        "series": series, "materials": materials, "classes": class_ranking(ctx, ms)[:6],
        "top_students": ranking_rows(ctx, ms, limit=5), "rewards": rewards, "recent": recent,
    }


MATERIAL_FIELDS = {"name": str, "icon": str, "unit": str, "points": int, "weight_kg": float, "co2_kg": float,
                   "water_l": float, "energy_kwh": float, "max_per_day": int, "color": str, "active": int}
REWARD_FIELDS = {"name": str, "description": str, "icon": str, "category": str, "cost": int, "stock": "int?", "active": int}
CHALLENGE_FIELDS = {"title": str, "description": str, "icon": str, "material_id": "int?", "target": int, "bonus": int,
                    "start_date": str, "end_date": str, "active": int}


def clean(body, fields, partial=False):
    out = {}
    for k, t in fields.items():
        if k not in body:
            continue
        v = body[k]
        if t == "int?":
            out[k] = None if v in (None, "", "null") else to_int(v, k, 0)
        elif t is int:
            out[k] = to_int(1 if v is True else 0 if v is False else v, k, 0)
        elif t is float:
            out[k] = to_float(v, k)
        else:
            out[k] = str(v or "").strip()
    return out


def save_entity(ctx, table, fields, eid, required, label):
    data = clean(ctx.body, fields)
    if eid is None:
        for r in required:
            require(data.get(r) not in (None, ""), f"Preencha o campo obrigatório: {r}.")
        data.setdefault("active", 1)
        if table == "rewards":
            data["created_at"] = now()
        cols = ",".join(data)
        new_id = ctx.run(f"INSERT INTO {table}({cols}) VALUES ({','.join('?' * len(data))})", list(data.values())).lastrowid
        ctx.audit(f"{label}_create", data.get("name") or data.get("title"))
        return {"id": new_id}
    require(ctx.one(f"SELECT id FROM {table} WHERE id=?", (eid,)), "Registro não encontrado.", 404)
    for r in required:
        if r in data:
            require(data[r] not in (None, ""), f"Preencha o campo obrigatório: {r}.")
    if data:
        ctx.run(f"UPDATE {table} SET {','.join(k + '=?' for k in data)} WHERE id=?", list(data.values()) + [eid])
    ctx.audit(f"{label}_update", f"#{eid} {json.dumps(data, ensure_ascii=False)}")
    return {"id": int(eid)}


@route("POST", "/api/admin/materials", ADMIN)
def material_create(ctx):
    return save_entity(ctx, "materials", MATERIAL_FIELDS, None, ["name", "points"], "material")


@route("PUT", r"/api/admin/materials/(\d+)", ADMIN)
def material_update(ctx, mid):
    return save_entity(ctx, "materials", MATERIAL_FIELDS, mid, ["name", "points"], "material")


@route("GET", "/api/admin/rewards", ADMIN)
def admin_rewards(ctx):
    rows = ctx.all("SELECT rw.*, (SELECT COUNT(*) FROM redemptions r WHERE r.reward_id=rw.id AND r.status!='cancelled') redeemed"
                   " FROM rewards rw ORDER BY rw.active DESC, rw.cost")
    return {"rewards": rows}


@route("POST", "/api/admin/rewards", ADMIN)
def reward_create(ctx):
    return save_entity(ctx, "rewards", REWARD_FIELDS, None, ["name", "cost"], "reward")


@route("PUT", r"/api/admin/rewards/(\d+)", ADMIN)
def reward_update(ctx, rid):
    return save_entity(ctx, "rewards", REWARD_FIELDS, rid, ["name", "cost"], "reward")


def check_challenge_dates(ctx):
    s, e = ctx.body.get("start_date"), ctx.body.get("end_date")
    for v in (s, e):
        if v is not None:
            try:
                date.fromisoformat(v)
            except (TypeError, ValueError):
                raise ApiError(400, "Datas inválidas (use AAAA-MM-DD).")
    if s and e:
        require(s <= e, "A data de término deve ser depois do início.")


@route("POST", "/api/admin/challenges", ADMIN)
def challenge_create(ctx):
    check_challenge_dates(ctx)
    return save_entity(ctx, "challenges", CHALLENGE_FIELDS, None, ["title", "target", "bonus", "start_date", "end_date"], "challenge")


@route("PUT", r"/api/admin/challenges/(\d+)", ADMIN)
def challenge_update(ctx, cid):
    check_challenge_dates(ctx)
    return save_entity(ctx, "challenges", CHALLENGE_FIELDS, cid, ["title", "target", "bonus", "start_date", "end_date"], "challenge")


@route("GET", "/api/admin/challenges", ADMIN)
def admin_challenges(ctx):
    rows = ctx.all("SELECT ch.*, m.name material_name, (SELECT COUNT(*) FROM challenge_completions cc WHERE cc.challenge_id=ch.id)"
                   " completions FROM challenges ch LEFT JOIN materials m ON m.id=ch.material_id ORDER BY ch.end_date DESC")
    return {"challenges": rows}


@route("GET", "/api/admin/users", ADMIN)
def admin_users(ctx):
    sql = ("SELECT u.id, u.name, u.email, u.role, u.class_id, u.registration, u.active, u.avatar_color, u.created_at,"
           " c.name class_name, (SELECT COALESCE(SUM(points),0) FROM transactions t WHERE t.user_id=u.id) balance,"
           " (SELECT COALESCE(SUM(points),0) FROM transactions t WHERE t.user_id=u.id AND t.type IN ('delivery','bonus')) earned"
           " FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE 1=1")
    args = []
    if ctx.q("role"):
        sql += " AND u.role=?"
        args.append(ctx.q("role"))
    if ctx.q("class_id"):
        sql += " AND u.class_id=?"
        args.append(ctx.q("class_id"))
    if ctx.q("q"):
        sql += " AND (u.name LIKE ? OR u.email LIKE ? OR u.registration LIKE ?)"
        args += [f"%{ctx.q('q')}%"] * 3
    return {"users": ctx.all(sql + " ORDER BY u.role DESC, u.name", args)}


def validate_user_payload(ctx, b, uid=None):
    data = {}
    if "name" in b:
        data["name"] = str(b["name"]).strip()
        require(len(data["name"]) >= 3, "Nome muito curto.")
    if "email" in b:
        data["email"] = str(b["email"]).strip().lower()
        require(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", data["email"]), "E-mail inválido.")
        dup = ctx.val("SELECT id FROM users WHERE lower(email)=? AND id!=?", (data["email"], uid or 0))
        require(not dup, "Já existe um usuário com este e-mail.")
    if "role" in b:
        require(b["role"] in ANY, "Perfil inválido.")
        data["role"] = b["role"]
    if "class_id" in b:
        data["class_id"] = None if b["class_id"] in (None, "") else to_int(b["class_id"], "turma")
    if "active" in b:
        data["active"] = 1 if b["active"] in (1, "1", True) else 0
    if b.get("password"):
        require(len(str(b["password"])) >= 6, "A senha deve ter pelo menos 6 caracteres.")
        data["password_hash"] = db.hash_password(str(b["password"]))
    return data


@route("POST", "/api/admin/users", ADMIN)
def user_create(ctx):
    b = dict(ctx.body)
    b.setdefault("password", db.DEFAULT_PASSWORD)
    for f in ("name", "email", "role"):
        require(b.get(f), f"Preencha o campo obrigatório: {f}.")
    data = validate_user_payload(ctx, b)
    if data["role"] == "student":
        require(data.get("class_id"), "Selecione a turma do aluno.")
        last = ctx.val("SELECT MAX(CAST(registration AS INTEGER)) FROM users WHERE registration IS NOT NULL")
        data["registration"] = str((last or 2026000) + 1)
        data["qr_token"] = db.new_qr_token()
    else:
        data["class_id"] = None
    data["avatar_color"] = secrets.choice(db.COLORS)
    data["created_at"] = now()
    uid = ctx.run(f"INSERT INTO users({','.join(data)}) VALUES ({','.join('?' * len(data))})", list(data.values())).lastrowid
    ctx.audit("user_create", f"{data['name']} ({data['role']})")
    return {"id": uid, "registration": data.get("registration")}


@route("PUT", r"/api/admin/users/(\d+)", ADMIN)
def user_update(ctx, uid):
    u = ctx.one("SELECT * FROM users WHERE id=?", (uid,))
    require(u, "Usuário não encontrado.", 404)
    data = validate_user_payload(ctx, ctx.body, int(uid))
    if int(uid) == ctx.user["id"]:
        require(data.get("active", 1) == 1 and data.get("role", "admin") == "admin",
                "Você não pode desativar ou rebaixar a própria conta.")
    if data.get("role", u["role"]) == "student" and not u["qr_token"]:
        data["qr_token"] = db.new_qr_token()
        if not u["registration"]:
            last = ctx.val("SELECT MAX(CAST(registration AS INTEGER)) FROM users WHERE registration IS NOT NULL")
            data["registration"] = str((last or 2026000) + 1)
    if data:
        ctx.run(f"UPDATE users SET {','.join(k + '=?' for k in data)} WHERE id=?", list(data.values()) + [uid])
    if data.get("active") == 0 or "password_hash" in data:
        ctx.run("DELETE FROM sessions WHERE user_id=?", (uid,))
    ctx.audit("user_update", f"#{uid} " + ", ".join(k for k in data if k != "password_hash") + (" +senha" if "password_hash" in data else ""))
    return {"ok": True}


@route("POST", r"/api/admin/users/(\d+)/reset-qr", ADMIN)
def user_reset_qr(ctx, uid):
    u = ctx.one("SELECT * FROM users WHERE id=? AND role='student'", (uid,))
    require(u, "Aluno não encontrado.", 404)
    ctx.run("UPDATE users SET qr_token=? WHERE id=?", (db.new_qr_token(), uid))
    ctx.audit("qr_reset", u["name"])
    return {"ok": True}


@route("POST", r"/api/admin/users/(\d+)/adjust", ADMIN)
def user_adjust(ctx, uid):
    u = ctx.one("SELECT * FROM users WHERE id=? AND role='student'", (uid,))
    require(u, "Aluno não encontrado.", 404)
    pts = to_int(ctx.body.get("points"), "pontos", -1000, 1000)
    require(pts != 0, "Informe um valor diferente de zero.")
    reason = str(ctx.body.get("reason", "")).strip()
    require(len(reason) >= 5, "Descreva o motivo do ajuste (mín. 5 caracteres).")
    require(balance(ctx, u["id"]) + pts >= 0, "O ajuste deixaria o saldo do aluno negativo.")
    ctx.run("INSERT INTO transactions(user_id,type,points,description,created_at) VALUES (?,?,?,?,?)",
            (u["id"], "adjust", pts, f"Ajuste manual: {reason}", now()))
    ctx.audit("points_adjust", f"{u['name']} {pts:+d} — {reason}")
    return {"balance": balance(ctx, u["id"])}


@route("POST", "/api/admin/classes", ADMIN)
def class_create(ctx):
    name = str(ctx.body.get("name", "")).strip()
    require(name, "Informe o nome da turma.")
    require(not ctx.val("SELECT id FROM classes WHERE name=?", (name,)), "Turma já existe.")
    cid = ctx.run("INSERT INTO classes(name, shift) VALUES (?,?)", (name, ctx.body.get("shift") or "Manhã")).lastrowid
    ctx.audit("class_create", name)
    return {"id": cid}


@route("GET", "/api/admin/fraud", ADMIN)
def admin_fraud(ctx):
    pending = ctx.all("SELECT d.*, u.name student_name, u.registration, c.name class_name, s.name staff_name FROM deliveries d"
                      " JOIN users u ON u.id=d.student_id LEFT JOIN classes c ON c.id=u.class_id JOIN users s ON s.id=d.staff_id"
                      " WHERE d.status='pending' ORDER BY d.created_at DESC")
    for p in pending:
        p["items"] = ctx.all("SELECT di.quantity, di.points, m.name, m.icon FROM delivery_items di JOIN materials m"
                             " ON m.id=di.material_id WHERE di.delivery_id=?", (p["id"],))
    show = ctx.q("resolved", "0")
    alerts = ctx.all("SELECT a.*, u.name student_name, s.name staff_name, r.name resolved_by_name FROM fraud_alerts a"
                     " LEFT JOIN users u ON u.id=a.student_id LEFT JOIN users s ON s.id=a.staff_id"
                     " LEFT JOIN users r ON r.id=a.resolved_by" + ("" if show == "all" else " WHERE a.resolved=0") +
                     " ORDER BY a.resolved, a.created_at DESC LIMIT 100")
    staff_stats = ctx.all(
        "SELECT s.id, s.name, COUNT(d.id) total, SUM(d.status='pending') pending, SUM(d.status='rejected') rejected,"
        " SUM(d.method='manual') manual FROM users s LEFT JOIN deliveries d ON d.staff_id=s.id AND d.created_at >= ?"
        " WHERE s.role IN ('staff','admin') GROUP BY s.id ORDER BY total DESC", (fmt(datetime.now() - timedelta(days=30)),))
    st = ctx.all("SELECT * FROM settings ORDER BY rowid")
    return {"pending": pending, "alerts": alerts, "staff": staff_stats, "settings": st}


@route("POST", r"/api/admin/deliveries/(\d+)/(approve|reject)", ADMIN)
def review_delivery(ctx, did, action):
    d = ctx.one("SELECT * FROM deliveries WHERE id=?", (did,))
    require(d, "Entrega não encontrada.", 404)
    require(d["status"] == "pending", "Esta entrega já foi revisada.")
    ts = now()
    status = "approved" if action == "approve" else "rejected"
    ctx.run("UPDATE deliveries SET status=?, reviewed_by=?, reviewed_at=? WHERE id=?", (status, ctx.user["id"], ts, did))
    ctx.run("UPDATE fraud_alerts SET resolved=1, resolved_by=?, resolved_at=? WHERE delivery_id=?", (ctx.user["id"], ts, did))
    out = {"status": status}
    if status == "approved":
        desc = ", ".join(f"{i['quantity']}× {i['name']}" for i in ctx.all(
            "SELECT di.quantity, m.name FROM delivery_items di JOIN materials m ON m.id=di.material_id WHERE di.delivery_id=?", (did,)))
        ctx.run("INSERT INTO transactions(user_id,type,points,ref_id,description,created_at) VALUES (?,?,?,?,?,?)",
                (d["student_id"], "delivery", d["total_points"], d["id"], desc + " (aprovada após revisão)", ts))
        out["challenges"], out["achievements"] = evaluate_rewards(ctx, d["student_id"])
    ctx.audit(f"delivery_{status}", f"#{did}")
    return out


@route("POST", r"/api/admin/alerts/(\d+)/resolve", ADMIN)
def resolve_alert(ctx, aid):
    ctx.run("UPDATE fraud_alerts SET resolved=1, resolved_by=?, resolved_at=? WHERE id=?", (ctx.user["id"], now(), aid))
    ctx.audit("alert_resolve", f"#{aid}")
    return {"ok": True}


@route("PUT", "/api/admin/settings", ADMIN)
def update_settings(ctx):
    current = settings(ctx)
    for k, v in ctx.body.items():
        require(k in current, f"Configuração desconhecida: {k}")
        ctx.run("UPDATE settings SET value=? WHERE key=?", (to_int(v, k, 0, 100000), k))
    ctx.audit("settings_update", json.dumps(ctx.body))
    return {"ok": True}


@route("GET", "/api/admin/audit", ADMIN)
def admin_audit(ctx):
    return {"log": ctx.all("SELECT a.*, u.name user_name, u.role FROM audit_log a LEFT JOIN users u ON u.id=a.user_id"
                           " ORDER BY a.id DESC LIMIT 300")}


# ---------------------------------------------------------------------------
# Servidor HTTP
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "EcoPoint/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        if self.path.startswith("/api/") and "--quiet" not in sys.argv:
            sys.stdout.write(f"[{datetime.now():%H:%M:%S}] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}\n")

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        require(length < 1_000_000, "Requisição muito grande.", 413)
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "JSON inválido.")
        require(isinstance(data, dict), "JSON inválido.")
        return data

    def dispatch(self, method):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api(method, parsed.path, parse_qs(parsed.query))
        elif method == "GET":
            self.serve_static(parsed.path)
        else:
            self.send_json(405, {"error": "Método não permitido"})

    def handle_api(self, method, path, query):
        for m, rx, roles, fn in ROUTES:
            if m != method:
                continue
            match = rx.match(path)
            if not match:
                continue
            conn = db.connect()
            try:
                with (WRITE_LOCK if method != "GET" else nullcontext()):
                    body = self.read_json() if method in ("POST", "PUT") else {}
                    auth = self.headers.get("Authorization", "")
                    token = auth[7:] if auth.startswith("Bearer ") else None
                    user = None
                    if token:
                        row = conn.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id"
                                           " WHERE s.token=? AND s.expires_at > ? AND u.active=1", (token, now())).fetchone()
                        user = dict(row) if row else None
                    if roles is not None:
                        if not user:
                            raise ApiError(401, "Sessão expirada. Faça login novamente.")
                        if user["role"] not in roles:
                            raise ApiError(403, "Você não tem permissão para esta ação.")
                    ctx = Ctx(conn, user, body, query, self.client_address[0], token)
                    result = fn(ctx, *match.groups())
                    conn.commit()
                self.send_json(200, result)
            except ApiError as e:
                conn.rollback()
                self.send_json(e.status, {"error": e.message})
            except Exception:
                conn.rollback()
                traceback.print_exc()
                self.send_json(500, {"error": "Erro interno no servidor."})
            finally:
                conn.close()
            return
        self.send_json(404, {"error": "Rota não encontrada."})

    def serve_static(self, path):
        rel = os.path.normpath(path.lstrip("/")).replace("\\", "/")
        full = os.path.join(STATIC, rel)
        if rel in (".", "") or rel.startswith("..") or not os.path.isfile(full):
            full = os.path.join(STATIC, "index.html")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main():
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    if "--reset" in sys.argv:
        db.seed(force=True)
        print("Banco recriado com dados fictícios.")
    elif db.seed():
        print("Banco criado com dados fictícios.")
    else:
        db.init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("\n  EcoPoint rodando!")
    print(f"  Neste computador:  http://localhost:{PORT}")
    ip = lan_ip()
    if ip:
        print(f"  Na mesma rede Wi-Fi: http://{ip}:{PORT}")
    print("\n  Contas de teste (senha 123456): aluno@ecopoint.com | funcionario@ecopoint.com | admin@ecopoint.com")
    print("  Ctrl+C para encerrar.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")


if __name__ == "__main__":
    main()
