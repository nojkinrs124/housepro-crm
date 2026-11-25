from __future__ import annotations

import re
from datetime import datetime
from typing import Any

GROUP_ID = "-1004299917388"
THREAD_ID = "99"

_KIND_ALIASES = {
    "хвс": "cold_water",
    "холодная вода": "cold_water",
    "гвс": "hot_water",
    "горячая вода": "hot_water",
    "электричество": "electricity",
    "электроэнергия": "electricity",
    "свет": "electricity",
    "газ": "gas",
    "отопление": "heating",
    "другой": "other",
}
_MISSING_SERIAL = {"", "—", "-", "нет", "без номера", "не указан"}
_CONFIRMATION = re.compile(r"^(подтвердить|сохранить)\s+([a-z0-9]{8})$", re.IGNORECASE)
_CANCELLATION = re.compile(r"^(отмена|отменить)\s+([a-z0-9]{8})$", re.IGNORECASE)


def _fold(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().replace("ё", "е")).strip()


def _parse_date(value: str) -> str:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError("Дата нужна в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ")


def _parse_kind(value: str) -> str:
    candidate = re.sub(r"^(?:тип|вид)\s*:\s*", "", value.strip(), flags=re.IGNORECASE)
    kind = _KIND_ALIASES.get(_fold(candidate))
    if not kind:
        raise ValueError(f"Неизвестный вид счётчика: {candidate}")
    return kind


def _field_value(segment: str, labels: tuple[str, ...]) -> str | None:
    for label in labels:
        match = re.match(rf"^{label}\s*:?\s*(.*)$", segment, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def parse_submission(text: str) -> dict[str, Any]:
    """Parse the strict Russian template; never guess missing property/date/meter fields."""
    address: str | None = None
    raw_date: str | None = None
    correction_reason: str | None = None
    readings: list[dict[str, Any]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        header = re.match(r"^(?:квартира|адрес|объект)\s*:\s*(.+)$", line, flags=re.IGNORECASE)
        if header:
            if address is not None:
                raise ValueError("Укажите адрес только один раз")
            address = header.group(1).strip()
            continue
        date_header = re.match(r"^дата(?:\s+снятия)?\s*:\s*(.+)$", line, flags=re.IGNORECASE)
        if date_header:
            if raw_date is not None:
                raise ValueError("Укажите дату только один раз")
            raw_date = date_header.group(1).strip()
            continue
        correction_header = re.match(r"^(?:исправление|коррекция)\s*:\s*(.+)$", line, flags=re.IGNORECASE)
        if correction_header:
            if correction_reason is not None:
                raise ValueError("Укажите причину исправления только один раз")
            correction_reason = correction_header.group(1).strip()
            if not correction_reason or len(correction_reason) > 300:
                raise ValueError("Причина исправления — от 1 до 300 символов")
            continue
        if "|" not in line:
            continue

        segments = [part.strip() for part in line.split("|")]
        if len(segments) != 4:
            raise ValueError("Для каждого счётчика нужно 4 поля через |: тип | контур | номер | показание")
        kind = _parse_kind(segments[0])
        contour = _field_value(segments[1], ("контур",))
        serial = _field_value(segments[2], (r"сч[её]тчик(?:а)?(?:\s*№)?", r"№\s*сч[её]тчика"))
        raw_value = _field_value(segments[3], ("показание", "значение"))
        if contour is None or not contour:
            raise ValueError("В строке счётчика укажите свободное поле «Контур»")
        if len(contour) > 100:
            raise ValueError("Название контура — не длиннее 100 символов")
        if serial is None:
            raise ValueError("В строке счётчика укажите номер или «без номера»")
        if raw_value is None or not re.fullmatch(r"\d+(?:[.,]\d{1,6})?", raw_value):
            raise ValueError("Показание должно быть неотрицательным числом без разделителей тысяч")
        value = float(raw_value.replace(",", "."))
        if value > 1_000_000_000:
            raise ValueError("Показание слишком большое — проверьте цифры")
        serial_number = None if _fold(serial) in _MISSING_SERIAL else serial
        key = (kind, _fold(contour))
        if any((item["kind"], _fold(item["contour"])) == key for item in readings):
            raise ValueError(f"Контур «{contour}» указан повторно для этого вида счётчика")
        readings.append({
            "kind": kind,
            "contour": contour,
            "serial_number": serial_number,
            "value": value,
        })
        if len(readings) > 10:
            raise ValueError("За одно сообщение можно внести не более 10 показаний")

    if not address:
        raise ValueError("Не указан адрес квартиры")
    if not raw_date:
        raise ValueError("Не указана дата снятия показаний")
    if not readings:
        raise ValueError("Не найдены строки счётчиков")
    return {
        "address": address,
        "reading_date": _parse_date(raw_date),
        "correction_reason": correction_reason,
        "readings": readings,
    }


def parse_command(text: str) -> tuple[str, str] | None:
    normalized = " ".join(text.strip().split())
    confirm = _CONFIRMATION.fullmatch(normalized)
    if confirm:
        return "confirm", confirm.group(2).upper()
    cancel = _CANCELLATION.fullmatch(normalized)
    if cancel:
        return "cancel", cancel.group(2).upper()
    return None


def is_target_event(platform: str, chat_id: str, thread_id: str) -> bool:
    return str(platform).lower() == "telegram" and str(chat_id) == GROUP_ID and str(thread_id) == THREAD_ID
