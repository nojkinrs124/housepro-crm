from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .parsing import GROUP_ID, THREAD_ID, is_target_event, parse_command, parse_submission

_LOG = logging.getLogger("hermes.housepro_meter_readings")
_CRM_BASE = "https://housepro24.ru/api/v1/meters"
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MAX_TOTAL_IMAGE_BYTES = 50 * 1024 * 1024
_TTL_SECONDS = 10 * 60
_KIND_LABELS = {
    "cold_water": "Холодная вода",
    "hot_water": "Горячая вода",
    "electricity": "Электричество",
    "gas": "Газ",
    "heating": "Отопление",
    "other": "Другой счётчик",
}


class MeterFlowError(Exception):
    """A safe-to-show validation or CRM error."""


def _platform_value(source: Any) -> str:
    value = getattr(source, "platform", "")
    return str(getattr(value, "value", value)).lower()


def _home() -> Path:
    configured = os.environ.get("HERMES_HOME")
    if configured:
        return Path(configured).expanduser()
    try:
        from hermes_constants import get_hermes_home

        return Path(get_hermes_home())
    except (ImportError, AttributeError):
        return Path.home() / ".hermes"


def _state_dir() -> Path:
    path = _home() / "cache" / "housepro-meter-readings"
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        path.chmod(0o700)
    except OSError:
        pass
    return path


def _db() -> sqlite3.Connection:
    path = _state_dir() / "pending.sqlite3"
    connection = sqlite3.connect(path, timeout=4)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS pending (
            token TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            actor_name TEXT,
            source_message_id TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            attachments_json TEXT NOT NULL,
            preview_reply TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            committed_reply TEXT
        )"""
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS pending_topic_idx ON pending(chat_id, thread_id, expires_at)"
    )
    connection.commit()
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return connection


@contextmanager
def _db_session():
    connection = _db()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _read_field(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _clean_text(value: Any, limit: int = 120) -> str:
    return re.sub(r"[\x00-\x1f\x7f]", "", str(value or "")).strip()[:limit]


def _api_key() -> str:
    key = os.environ.get("HOUSEPRO_BOT_API_KEY", "").strip()
    if not key:
        # Ключ может появиться в .env уже после старта gateway: читаем файл сами,
        # иначе перехват молчит до перезапуска сервиса.
        key = _env_file_value("HOUSEPRO_BOT_API_KEY")
    if not key:
        raise MeterFlowError("Связь с CRM пока не настроена. Показание не сохранено.")
    return key


def _env_file_value(name: str) -> str:
    """Read one value from $HERMES_HOME/.env without importing Hermes internals."""
    path = _home() / ".env"
    try:
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            match = re.match(rf"^\s*(?:export\s+)?{re.escape(name)}\s*=\s*(.*)$", line)
            if not match:
                continue
            return match.group(1).strip().strip('"').strip("'")
    except OSError:
        return ""
    return ""


def _open_direct(request: urllib.request.Request, timeout: float = 8.0) -> tuple[int, bytes, str | None]:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.status, response.read(), response.headers.get("Content-Type")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), exc.headers.get("Content-Type")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise MeterFlowError("Не удалось связаться с сервисом. Попробуйте повторить позже.") from exc


def _telegram_proxy_url(gateway: Any) -> str | None:
    config = getattr(gateway, "config", None)
    platforms = getattr(config, "platforms", None)
    entries = platforms.items() if hasattr(platforms, "items") else []
    for platform, platform_config in entries:
        name = str(getattr(platform, "value", platform)).strip().lower()
        if name != "telegram":
            continue
        extra = getattr(platform_config, "extra", None)
        if isinstance(extra, dict):
            proxy = extra.get("proxy_url")
            if isinstance(proxy, str) and proxy.strip():
                return proxy.strip()
    return None


def _open_telegram(
    request: urllib.request.Request, gateway: Any = None, timeout: float = 6.0,
) -> tuple[int, bytes, str | None]:
    proxy = _telegram_proxy_url(gateway)
    if not proxy:
        raise MeterFlowError("Прокси Telegram не настроен. Обратитесь к администратору.")
    try:
        import httpx
    except ImportError as exc:
        raise MeterFlowError("Транспорт Telegram недоступен. Обратитесь к администратору.") from exc
    try:
        with httpx.Client(proxy=proxy, timeout=timeout, trust_env=False) as client:
            response = client.request(
                request.get_method(),
                request.full_url,
                headers=dict(request.header_items()),
                content=request.data,
            )
        return response.status_code, response.content, response.headers.get("Content-Type")
    except httpx.RequestError as exc:
        raise MeterFlowError("Не удалось связаться с Telegram через настроенный прокси.") from exc


def _crm_json(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    key = _api_key()
    url = _CRM_BASE + path
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
        telegram = payload.get("telegram") if payload and payload.get("source") == "telegram" else None
        if isinstance(telegram, dict):
            user_id = str(telegram.get("user_id") or "").strip()
            if user_id.isdecimal():
                username = _clean_text(telegram.get("username"), 200)
                headers["X-Bot-Requester"] = f"tg:{user_id}:{username}"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    status, raw, _ = _open_direct(request)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise MeterFlowError("CRM вернула непонятный ответ. Показание не сохранено.")
    if status >= 400:
        message = _clean_text(parsed.get("error") or parsed.get("message"), 240)
        raise MeterFlowError(message or "CRM отклонила запрос. Показание не сохранено.")
    if not isinstance(parsed, dict):
        raise MeterFlowError("CRM вернула непонятный ответ. Показание не сохранено.")
    return parsed


def _fold(value: str) -> str:
    return re.sub(r"[^0-9a-zа-яё]+", "", value.casefold().replace("ё", "е"))


def _address_tokens(value: str) -> set[str]:
    ignored = {"ул", "улица", "д", "дом", "кв", "квартира", "корп", "корпус", "строение"}
    return {
        token for token in re.findall(r"[0-9a-zа-яё]+", value.casefold().replace("ё", "е"))
        if token not in ignored
    }


def _resolve_property(address: str) -> dict[str, Any]:
    query = urllib.parse.urlencode({"search": address})
    response = _crm_json("GET", "?" + query)
    items = response.get("data")
    if not isinstance(items, list):
        raise MeterFlowError("CRM не вернула список квартир. Проверьте адрес.")
    tokens = _address_tokens(address)
    if not tokens:
        raise MeterFlowError("Укажите адрес квартиры подробнее.")
    matches = [
        item for item in items
        if isinstance(item, dict)
        and tokens.issubset(_address_tokens(f"{item.get('title', '')} {item.get('address', '')}"))
    ]
    if len(matches) != 1:
        if matches:
            options = "; ".join(
                _clean_text(item.get("address") or item.get("title"), 100) for item in matches[:4]
            )
            raise MeterFlowError("Нашлось несколько квартир. Уточните адрес: " + options)
        raise MeterFlowError("Квартира по этому адресу не найдена. Проверьте адрес в CRM.")
    return matches[0]


def _match_meters(property_data: dict[str, Any], readings: list[dict[str, Any]]) -> None:
    meters = property_data.get("meters")
    if not isinstance(meters, list):
        raise MeterFlowError("CRM не вернула список счётчиков этой квартиры.")
    for line in readings:
        contour = _fold(line["contour"])
        candidates = [
            meter for meter in meters
            if isinstance(meter, dict)
            and meter.get("kind") == line["kind"]
            and _fold(str(meter.get("contour") or "")) == contour
        ]
        if len(candidates) != 1:
            available = [
                _clean_text(str(m.get("contour") or ""), 80)
                for m in meters if isinstance(m, dict) and m.get("kind") == line["kind"]
            ]
            if available:
                raise MeterFlowError(
                    f"В CRM не найден контур «{line['contour']}» для вида «{_KIND_LABELS.get(line['kind'], line['kind'])}». "
                    f"Сейчас заведены: {', '.join(available)}. Сначала настройте контур счётчика в CRM."
                )
            raise MeterFlowError(
                f"В CRM нет активного счётчика вида «{_KIND_LABELS.get(line['kind'], line['kind'])}». "
                "Сначала заведите его в карточке квартиры."
            )
        meter = candidates[0]
        actual_serial = str(meter.get("serial_number") or "").strip()
        submitted_serial = line.get("serial_number")
        if actual_serial and submitted_serial and actual_serial.casefold() != submitted_serial.casefold():
            raise MeterFlowError(
                f"Номер счётчика для контура «{line['contour']}» не совпадает с CRM. "
                "Проверьте номер или карточку счётчика."
            )
        line["serial_number"] = actual_serial or submitted_serial


def _capture_attachments(event: Any) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    source_paths = list(getattr(event, "media_urls", None) or [])
    declared_types = list(getattr(event, "media_types", None) or [])
    directory = _state_dir() / ("inbound-" + secrets.token_hex(8))
    total = 0

    for index, raw_path in enumerate(source_paths[:10]):
        path_text = str(raw_path)
        if path_text.startswith("file://"):
            path_text = urllib.parse.unquote(urllib.parse.urlparse(path_text).path)
        source_path = Path(path_text)
        if not source_path.is_file():
            continue
        declared = str(declared_types[index]) if index < len(declared_types) else ""
        mime = declared if declared.startswith("image/") else mimetypes.guess_type(source_path.name)[0]
        if mime not in {"image/jpeg", "image/png", "image/webp"}:
            continue
        size = source_path.stat().st_size
        if size <= 0 or size > _MAX_IMAGE_BYTES:
            raise MeterFlowError("Фото слишком большое или пустое. Максимум 10 МБ на одно фото.")
        total += size
        if total > _MAX_TOTAL_IMAGE_BYTES:
            raise MeterFlowError("Общий размер фотографий больше 50 МБ.")
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[mime]
        destination = directory / f"{index + 1}{ext}"
        shutil.copyfile(source_path, destination)
        destination.chmod(0o600)
        files.append({
            "type": "path",
            "path": str(destination),
            "mime": mime,
            "filename": destination.name,
        })

    if files:
        return files

    raw_message = getattr(event, "raw_message", None)
    photos = _read_field(raw_message, "photo", []) or []
    if photos:
        photo = photos[-1]
        file_id = _read_field(photo, "file_id")
        if file_id:
            files.append({
                "type": "telegram",
                "file_id": str(file_id),
                "mime": "image/jpeg",
                "filename": "photo.jpg",
            })
    return files


def _telegram_download(file_id: str, gateway: Any = None) -> tuple[bytes, str, str]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise MeterFlowError("Загрузка фото не настроена. Показание не сохранено.")
    query = urllib.parse.urlencode({"file_id": file_id})
    request = urllib.request.Request(f"https://api.telegram.org/bot{token}/getFile?{query}")
    status, raw, _ = _open_telegram(request, gateway)
    if status >= 400:
        raise MeterFlowError("Telegram не отдал фото. Показание не сохранено.")
    try:
        result = json.loads(raw.decode("utf-8"))
        file_path = result["result"]["file_path"]
    except (KeyError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        raise MeterFlowError("Telegram не отдал файл фото. Показание не сохранено.")
    download_request = urllib.request.Request(f"https://api.telegram.org/file/bot{token}/{file_path}")
    status, data, content_type = _open_telegram(download_request, gateway, timeout=12.0)
    if status >= 400 or not data or len(data) > _MAX_IMAGE_BYTES:
        raise MeterFlowError("Не удалось получить фото или файл больше 10 МБ.")
    mime = content_type.split(";", 1)[0].strip() if content_type else "image/jpeg"
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        mime = "image/jpeg"
    filename = Path(file_path).name or "photo.jpg"
    return data, mime, filename


def _upload_photo(attachment: dict[str, str], gateway: Any = None) -> str:
    if attachment["type"] == "path":
        path = Path(attachment["path"])
        if not path.is_file():
            raise MeterFlowError("Временный файл фото потерян. Отправьте показание и фото ещё раз.")
        data = path.read_bytes()
        mime = attachment["mime"]
        filename = attachment["filename"]
    else:
        data, mime, filename = _telegram_download(attachment["file_id"], gateway)
    if len(data) > _MAX_IMAGE_BYTES:
        raise MeterFlowError("Фото больше 10 МБ. Показание не сохранено.")

    boundary = "----HermesMeter" + uuid.uuid4().hex
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:80] or "photo.jpg"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{safe_name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("ascii") + data + f"\r\n--{boundary}--\r\n".encode("ascii")
    request = urllib.request.Request(
        _CRM_BASE + "/photos",
        data=body,
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
        method="POST",
    )
    status, raw, _ = _open_direct(request, timeout=12.0)
    try:
        response = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise MeterFlowError("CRM не подтвердила загрузку фото.")
    if status >= 400:
        message = _clean_text(response.get("error"), 200)
        raise MeterFlowError(message or "CRM не приняла фото.")
    url = response.get("data", {}).get("url") if isinstance(response.get("data"), dict) else None
    if not isinstance(url, str) or not url.startswith("https://"):
        raise MeterFlowError("CRM загрузила фото без ссылки. Показание не сохранено.")
    return url


def _upload_photos(attachments: list[dict[str, str]], gateway: Any = None) -> list[str]:
    if not attachments:
        return []
    with ThreadPoolExecutor(max_workers=min(len(attachments), 10), thread_name_prefix="meter-photo") as pool:
        return list(pool.map(lambda item: _upload_photo(item, gateway), attachments))


def _send_reply(event: Any, text: str, gateway: Any = None) -> bool:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        _LOG.error("Telegram meter reply skipped: bot token is not configured")
        return False
    source = getattr(event, "source", None)
    chat_id = str(getattr(source, "chat_id", GROUP_ID))
    thread_id = str(getattr(source, "thread_id", THREAD_ID))
    message_id = getattr(event, "message_id", None)
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "message_thread_id": int(thread_id),
        "text": text[:3900],
        "disable_web_page_preview": True,
    }
    if message_id is not None:
        payload["reply_to_message_id"] = int(message_id)
        payload["allow_sending_without_reply"] = True
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        status, raw, _ = _open_telegram(request, gateway, timeout=6.0)
        if status >= 400:
            _LOG.error("Telegram meter reply failed with HTTP %s", status)
            return False
        result = json.loads(raw.decode("utf-8"))
        return bool(result.get("ok"))
    except Exception as exc:  # fail closed; never hand the group to the general agent
        _LOG.error("Telegram meter reply failed (%s)", type(exc).__name__)
        return False


def _format_number(value: Any) -> str:
    if value is None:
        return "—"
    number = float(value)
    text = f"{number:,.3f}".rstrip("0").rstrip(".")
    return text.replace(",", " ").replace(".", ",")


def _preview_text(property_data: dict[str, Any], date: str, readings: list[dict[str, Any]],
                  response: dict[str, Any], photo_count: int) -> str:
    data = response.get("data") if isinstance(response.get("data"), dict) else {}
    plans = data.get("planned")
    if not isinstance(plans, list) or len(plans) != len(readings):
        raise MeterFlowError("CRM не вернула расчёт для каждого счётчика. Ничего не сохранено.")
    errors = data.get("errors") or []
    if errors:
        raise MeterFlowError("; ".join(_clean_text(error, 180) for error in errors))
    address = _clean_text(property_data.get("address") or property_data.get("title"), 180)
    lines = [f"Проверка показаний — {address}", f"Дата снятия: {date}"]
    total = 0.0
    has_amount = False
    for line, plan in zip(readings, plans):
        if not isinstance(plan, dict):
            raise MeterFlowError("CRM вернула неполный расчёт. Ничего не сохранено.")
        kind = _KIND_LABELS.get(line["kind"], line["kind"])
        serial = f" · № {line['serial_number']}" if line.get("serial_number") else ""
        unit = _clean_text(plan.get("unit") or "", 16)
        label = f"• {kind} · контур {line['contour']}{serial}: {_format_number(line['value'])}"
        consumption = plan.get("consumption")
        amount = plan.get("amount")
        if consumption is None:
            lines.append(label + " — первое показание, расход пока не рассчитывается")
        elif amount is None:
            lines.append(label + f" — расход {_format_number(consumption)} {unit}, тариф не задан")
        else:
            tariff = plan.get("tariff")
            lines.append(
                label + f" — расход {_format_number(consumption)} {unit}"
                + (f" × {_format_number(tariff)} ₽" if tariff is not None else "")
                + f" = {_format_number(amount)} ₽"
            )
            total += float(amount)
            has_amount = True
        for warning in plan.get("warnings") or []:
            lines.append("  Внимание: " + _clean_text(warning, 180))
    if has_amount:
        lines.append(f"Сумма по рассчитанным счётчикам: {_format_number(round(total, 2))} ₽")
    lines.append(f"Фото: {photo_count} шт.")
    lines.append("\nПроверьте данные. Для записи в CRM отправьте: ПОДТВЕРДИТЬ {CODE}")
    lines.append("Отмена: ОТМЕНА {CODE}. Код действует 10 минут.")
    return "\n".join(lines)


def _existing_pending(chat_id: str, thread_id: str, actor_id: str,
                      source_message_id: str | None = None) -> sqlite3.Row | None:
    now = int(time.time())
    with _db_session() as db:
        _purge_expired(db, now)
        if source_message_id is not None:
            row = db.execute(
                "SELECT * FROM pending WHERE chat_id=? AND thread_id=? AND actor_id=? AND source_message_id=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1",
                (chat_id, thread_id, actor_id, source_message_id, now),
            ).fetchone()
            if row:
                return row
        return db.execute(
            "SELECT * FROM pending WHERE chat_id=? AND thread_id=? AND expires_at>? AND committed_reply IS NULL LIMIT 1",
            (chat_id, thread_id, now),
        ).fetchone()


def _stage_pending(chat_id: str, thread_id: str, actor_id: str, actor_name: str,
                   message_id: str, payload: dict[str, Any], attachments: list[dict[str, str]],
                   preview_reply: str) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    token = "".join(secrets.choice(alphabet) for _ in range(8))
    now = int(time.time())
    with _db_session() as db:
        _purge_expired(db, now)
        active = db.execute(
            "SELECT token FROM pending WHERE chat_id=? AND thread_id=? AND expires_at>? AND committed_reply IS NULL LIMIT 1",
            (chat_id, thread_id, now),
        ).fetchone()
        if active:
            raise MeterFlowError("В теме уже есть неподтверждённая карточка. Сначала подтвердите или отмените её.")
        db.execute(
            """INSERT INTO pending(token, chat_id, thread_id, actor_id, actor_name,
               source_message_id, payload_json, attachments_json, preview_reply,
               expires_at, committed_reply) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)""",
            (token, chat_id, thread_id, actor_id, actor_name, message_id,
             json.dumps(payload, ensure_ascii=False), json.dumps(attachments, ensure_ascii=False),
             preview_reply.replace("{CODE}", token), now + _TTL_SECONDS),
        )
    return token


def _cleanup_attachments(attachments: list[dict[str, str]]) -> None:
    parents = {str(Path(item["path"]).parent) for item in attachments if item.get("type") == "path"}
    for parent in parents:
        try:
            shutil.rmtree(parent)
        except OSError:
            pass


def _purge_expired(db: sqlite3.Connection, now: int) -> None:
    expired = db.execute(
        "SELECT attachments_json FROM pending WHERE expires_at<=?",
        (now,),
    ).fetchall()
    for row in expired:
        try:
            _cleanup_attachments(json.loads(row["attachments_json"]))
        except (TypeError, ValueError, KeyError):
            continue
    db.execute("DELETE FROM pending WHERE expires_at<=?", (now,))


def _process_submission(event: Any, chat_id: str, thread_id: str, actor_id: str,
                        actor_name: str, message_id: str) -> str:
    existing = _existing_pending(chat_id, thread_id, actor_id, message_id)
    if existing:
        return str(existing["preview_reply"])
    if _existing_pending(chat_id, thread_id, actor_id):
        raise MeterFlowError("В теме уже есть неподтверждённая карточка. Сначала подтвердите или отмените её.")

    parsed = parse_submission(str(getattr(event, "text", "") or ""))
    attachments = _capture_attachments(event)
    if not attachments:
        raise MeterFlowError("Прикрепите к этому же сообщению фото счётчика. Без фото запись не принимается.")

    try:
        property_data = _resolve_property(parsed["address"])
        _match_meters(property_data, parsed["readings"])
        payload = {
            "property_id": property_data.get("id"),
            "reading_date": parsed["reading_date"],
            "readings": parsed["readings"],
            "correction_reason": parsed["correction_reason"],
            "source": "telegram",
            "telegram": {
                "user_id": actor_id,
                "username": actor_name,
                "chat_id": chat_id,
                "thread_id": thread_id,
                "message_id": message_id,
            },
            "dry_run": True,
        }
        response = _crm_json("POST", "", payload)
        preview = _preview_text(property_data, parsed["reading_date"], parsed["readings"], response, len(attachments))
        # Save without the code first; _stage_pending substitutes the unique nonce.
        token = _stage_pending(chat_id, thread_id, actor_id, actor_name, message_id, payload,
                               attachments, preview)
        return preview.replace("{CODE}", token)
    except Exception:
        _cleanup_attachments(attachments)
        raise


def _fetch_pending(token: str, chat_id: str, thread_id: str) -> sqlite3.Row | None:
    now = int(time.time())
    with _db_session() as db:
        return db.execute(
            "SELECT * FROM pending WHERE token=? AND chat_id=? AND thread_id=? AND expires_at>? LIMIT 1",
            (token, chat_id, thread_id, now),
        ).fetchone()


def _save_confirmed(event: Any, token: str, chat_id: str, thread_id: str, actor_id: str, gateway: Any = None) -> str:
    row = _fetch_pending(token, chat_id, thread_id)
    if not row:
        raise MeterFlowError("Карточка не найдена или код истёк. Отправьте показания ещё раз.")
    if str(row["actor_id"]) != actor_id:
        raise MeterFlowError("Подтвердить или отменить карточку может только автор исходного сообщения.")
    if row["committed_reply"]:
        return str(row["committed_reply"])

    payload = json.loads(row["payload_json"])
    attachments = json.loads(row["attachments_json"])
    preview_payload = dict(payload)
    preview_payload["dry_run"] = True
    preview_result = _crm_json("POST", "", preview_payload)
    preview_data = preview_result.get("data")
    if not isinstance(preview_data, dict):
        preview_data = {}
    preview_plan = preview_data.get("planned")
    readings = payload.get("readings")
    if not isinstance(preview_plan, list) or not isinstance(readings, list) or len(preview_plan) != len(readings):
        raise MeterFlowError("CRM не вернула расчёт для каждого счётчика. Ничего не сохранено.")
    preview_errors = preview_data.get("errors") or [
        line.get("error") for line in preview_plan
        if isinstance(line, dict) and line.get("error")
    ]
    if preview_errors:
        detail = "; ".join(_clean_text(item, 180) for item in preview_errors)
        raise MeterFlowError(detail or "Проверка CRM не пройдена. Показание не сохранено.")

    if preview_plan and all(isinstance(line, dict) and line.get("duplicate") for line in preview_plan):
        property_label = _clean_text(preview_data.get("property") or "Квартира", 180)
        date = _clean_text(preview_data.get("reading_date") or payload.get("reading_date"), 20)
        reply = (
            f"Это показание уже записано в HousePro CRM: {property_label}.\n"
            f"Дата: {date}. Повторная запись не создавалась."
        )
        with _db_session() as db:
            db.execute(
                "UPDATE pending SET committed_reply=? WHERE token=? AND chat_id=? AND thread_id=? AND actor_id=?",
                (reply, token, chat_id, thread_id, actor_id),
            )
        _cleanup_attachments(attachments)
        return reply

    urls = payload.get("photo_urls")
    valid_cached_urls = (
        isinstance(urls, list)
        and len(urls) == len(attachments)
        and all(isinstance(url, str) and url.startswith("https://") for url in urls)
    )
    if not valid_cached_urls:
        urls = _upload_photos(attachments, gateway)
        if len(urls) != len(attachments) or not all(isinstance(url, str) and url.startswith("https://") for url in urls):
            raise MeterFlowError("CRM не вернула ссылки на все фото. Показание не сохранено.")
        payload["photo_urls"] = urls
        with _db_session() as db:
            updated = db.execute(
                "UPDATE pending SET payload_json=? WHERE token=? AND chat_id=? AND thread_id=? AND actor_id=? AND committed_reply IS NULL",
                (json.dumps(payload, ensure_ascii=False), token, chat_id, thread_id, actor_id),
            ).rowcount
        if updated != 1:
            raise MeterFlowError("Карточка истекла или уже обработана. Проверьте историю CRM.")

    payload.pop("dry_run", None)
    result = _crm_json("POST", "", payload)
    data = result.get("data")
    if not isinstance(data, dict):
        data = {}
    errors = data.get("errors") or []
    saved = data.get("saved") or []
    skipped = data.get("skipped") or []
    if errors:
        detail = "; ".join(_clean_text(item, 180) for item in errors)
        raise MeterFlowError(detail or "CRM не подтвердила сохранение")
    if not saved and not skipped:
        raise MeterFlowError("CRM не подтвердила сохранение")

    property_label = _clean_text(data.get("property") or "Квартира", 180)
    date = _clean_text(data.get("reading_date") or payload.get("reading_date"), 20)
    if saved:
        reply_lines = [f"Записано в HousePro CRM: {property_label}", f"Дата: {date}"]
        reply_lines.extend("• " + _clean_text(text, 220) for text in saved)
        total = data.get("total_utilities")
        if total is not None:
            reply_lines.append(f"Итого: {_format_number(total)} ₽")
        reply_lines.append(f"Фото сохранены в CRM: {len(urls)} шт.")
        if skipped:
            reply_lines.append(f"Уже принятые строки пропущены: {len(skipped)}.")
    else:
        reply_lines = [
            f"Это показание уже записано в HousePro CRM: {property_label}.",
            f"Дата: {date}. Повторная запись не создавалась.",
        ]
    reply = "\n".join(reply_lines)
    with _db_session() as db:
        db.execute(
            "UPDATE pending SET committed_reply=? WHERE token=? AND chat_id=? AND thread_id=? AND actor_id=?",
            (reply, token, chat_id, thread_id, actor_id),
        )
    _cleanup_attachments(attachments)
    return reply


def _cancel_pending(token: str, chat_id: str, thread_id: str, actor_id: str) -> str:
    with _db_session() as db:
        row = db.execute(
            "SELECT * FROM pending WHERE token=? AND chat_id=? AND thread_id=?",
            (token, chat_id, thread_id),
        ).fetchone()
        if not row:
            raise MeterFlowError("Карточка не найдена или код истёк.")
        if str(row["actor_id"]) != actor_id:
            raise MeterFlowError("Отменить карточку может только автор исходного сообщения.")
        if row["committed_reply"]:
            raise MeterFlowError("Эта карточка уже записана в CRM и не может быть отменена.")
        attachments = json.loads(row["attachments_json"])
        db.execute("DELETE FROM pending WHERE token=?", (token,))
    _cleanup_attachments(attachments)
    return "Карточка отменена. В CRM ничего не записывалось."


def _actor_name(event: Any) -> str:
    source = getattr(event, "source", None)
    raw_message = getattr(event, "raw_message", None)
    sender = _read_field(raw_message, "from_user", None)
    username = _clean_text(_read_field(sender, "username", ""), 64)
    if username:
        return "@" + username
    full_name = _clean_text(_read_field(sender, "full_name", ""), 64)
    return full_name or _clean_text(getattr(source, "user_name", ""), 64)


def _handle_topic_event(event: Any, gateway: Any = None) -> str | None:
    source = getattr(event, "source", None)
    chat_id = str(getattr(source, "chat_id", GROUP_ID))
    thread_id = str(getattr(source, "thread_id", THREAD_ID))
    actor_id = str(getattr(source, "user_id", "") or "")
    actor_name = _actor_name(event)
    message_id = str(getattr(event, "message_id", "") or "")
    raw_message = getattr(event, "raw_message", None)
    text = str(getattr(event, "text", "") or _read_field(raw_message, "caption", "") or "").strip()

    if not message_id:
        return "Не удалось определить номер сообщения. Попросите администратора проверить интеграцию."
    if not actor_id:
        return "Не удалось определить автора сообщения. Попросите администратора проверить доступ бота."
    command = parse_command(text)
    if command:
        action, token = command
        if action == "confirm":
            return _save_confirmed(event, token, chat_id, thread_id, actor_id, gateway)
        return _cancel_pending(token, chat_id, thread_id, actor_id)
    try:
        return _process_submission(event, chat_id, thread_id, actor_id, actor_name, message_id)
    except ValueError as exc:
        return str(exc)


def _is_authorized_meter_sender(actor_id: str) -> bool:
    """This CRM write flow is limited to explicitly listed Telegram user IDs."""
    normalized = str(actor_id or "").strip()
    if not normalized.isdecimal():
        return False
    configured = os.environ.get("TELEGRAM_ALLOWED_USERS", "")
    allowed = {
        item.strip()
        for item in re.split(r"[,\s]+", configured)
        if item.strip().isdecimal()
    }
    return normalized in allowed


async def pre_gateway_dispatch(event: Any, gateway: Any, session_store: Any, **kwargs: Any) -> dict[str, str] | None:
    """Keep the group isolated from the general agent; run blocking I/O off the gateway loop."""
    del session_store, kwargs
    source = getattr(event, "source", None)
    platform = _platform_value(source)
    chat_id = str(getattr(source, "chat_id", "") or "")
    thread_id = str(getattr(source, "thread_id", "") or "")
    if platform != "telegram" or chat_id != GROUP_ID:
        return None
    if thread_id != THREAD_ID:
        # Другие темы группы — обычный путь ассистента: перехватываем только
        # тему показаний, иначе бот умолкает во всей группе.
        return None
    if not is_target_event(platform, chat_id, thread_id):
        return {"action": "skip"}

    actor_id = str(getattr(source, "user_id", "") or "")
    if not _is_authorized_meter_sender(actor_id):
        if actor_id:
            await asyncio.to_thread(
                _send_reply, event,
                "Эта функция доступна только уполномоченным отправителям.",
                gateway,
            )
        return {"action": "skip"}

    try:
        reply = await asyncio.to_thread(_handle_topic_event, event, gateway)
        if reply:
            await asyncio.to_thread(_send_reply, event, reply, gateway)
    except MeterFlowError as exc:
        await asyncio.to_thread(_send_reply, event, str(exc), gateway)
    except Exception as exc:
        _LOG.error("HousePro meter flow failed (%s)", type(exc).__name__)
        await asyncio.to_thread(
            _send_reply, event,
            "Не удалось обработать показание. Оно не подтверждено и не записано; проверьте формат и попробуйте ещё раз.",
            gateway,
        )
    # Fail closed: no message from this group reaches the unrestricted assistant.
    return {"action": "skip"}
