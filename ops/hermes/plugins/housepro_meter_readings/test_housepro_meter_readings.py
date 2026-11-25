import asyncio
import inspect
import unittest
from unittest.mock import patch

from housepro_meter_readings import is_target_event, parse_command, parse_submission


class ApiKeySourceTests(unittest.TestCase):
    def test_reads_api_key_from_env_file_when_process_env_is_empty(self):
        import os
        import tempfile
        from pathlib import Path
        from housepro_meter_readings.integration import _api_key

        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, ".env").write_text(
                "TELEGRAM_BOT_TOKEN=x\nHOUSEPRO_BOT_API_KEY=hp_from_file\n", encoding="utf-8",
            )
            with patch.dict(os.environ, {"HERMES_HOME": tmp}, clear=False):
                os.environ.pop("HOUSEPRO_BOT_API_KEY", None)
                self.assertEqual(_api_key(), "hp_from_file")

    def test_process_env_wins_over_env_file(self):
        import os
        import tempfile
        from pathlib import Path
        from housepro_meter_readings.integration import _api_key

        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, ".env").write_text("HOUSEPRO_BOT_API_KEY=hp_from_file\n", encoding="utf-8")
            with patch.dict(os.environ, {"HERMES_HOME": tmp, "HOUSEPRO_BOT_API_KEY": "hp_from_env"}):
                self.assertEqual(_api_key(), "hp_from_env")


class MeterSubmissionTests(unittest.TestCase):
    def test_parses_multiple_readings_with_free_text_contours(self):
        parsed = parse_submission(
            "Квартира: Соколовская 72, кв. 83\n"
            "Дата: 23.11.2026\n"
            "ХВС | Контур: кухня | Счётчик: 123456 | Показание: 12,345\n"
            "Электричество | Контур: основной | Счётчик: без номера | Показание: 7421"
        )
        self.assertEqual(parsed["address"], "Соколовская 72, кв. 83")
        self.assertEqual(parsed["reading_date"], "2026-11-23")
        self.assertEqual(len(parsed["readings"]), 2)
        self.assertEqual(parsed["readings"][0], {
            "kind": "cold_water",
            "contour": "кухня",
            "serial_number": "123456",
            "value": 12.345,
        })
        self.assertEqual(parsed["readings"][1]["kind"], "electricity")
        self.assertIsNone(parsed["readings"][1]["serial_number"])

    def test_refuses_ambiguous_or_incomplete_reading_line(self):
        with self.assertRaises(ValueError):
            parse_submission(
                "Квартира: Соколовская 72\nДата: 23.11.2026\n"
                "ХВС | Контур: кухня | Показание: 12"
            )

    def test_parses_typed_confirmation_and_cancellation_nonce(self):
        self.assertEqual(parse_command("ПОДТВЕРДИТЬ A1B2C3D4"), ("confirm", "A1B2C3D4"))
        self.assertEqual(parse_command("ОТМЕНА A1B2C3D4"), ("cancel", "A1B2C3D4"))
        self.assertIsNone(parse_command("да"))

    def test_group_messages_are_never_fallen_through_to_the_general_agent(self):
        from housepro_meter_readings import pre_gateway_dispatch

        event = type("Event", (), {
            "source": type("Source", (), {
                "platform": "telegram",
                "chat_id": "-1004299917388",
                "thread_id": "99",
            })(),
            "text": "просто текст",
        })()
        with patch("housepro_meter_readings.integration._send_reply"):
            result = asyncio.run(pre_gateway_dispatch(event, gateway=None, session_store=None))
        self.assertEqual(result, {"action": "skip"})

    def test_messages_outside_the_group_are_not_intercepted(self):
        from housepro_meter_readings import pre_gateway_dispatch

        event = type("Event", (), {
            "source": type("Source", (), {
                "platform": "telegram",
                "chat_id": "12345",
                "thread_id": "99",
            })(),
            "text": "привет",
        })()
        self.assertIsNone(asyncio.run(pre_gateway_dispatch(event, gateway=None, session_store=None)))

    def test_other_topics_in_the_same_group_are_not_intercepted(self):
        from housepro_meter_readings import pre_gateway_dispatch

        event = type("Event", (), {
            "source": type("Source", (), {
                "platform": "telegram",
                "chat_id": "-1004299917388",
                "thread_id": "98",
            })(),
            "text": "запрос к боту",
        })()
        # Тема показаний одна; остальные темы группы идут обычным путём ассистента.
        self.assertIsNone(asyncio.run(pre_gateway_dispatch(event, gateway=None, session_store=None)))

    def test_preview_contains_the_confirmation_nonce(self):
        from housepro_meter_readings.integration import _process_submission

        event = type("Event", (), {
            "text": "Квартира: Соколовская 72, кв. 83\n"
                    "Дата: 23.11.2026\n"
                    "ХВС | Контур: кухня | Счётчик: 123456 | Показание: 13,345",
        })()
        property_data = {
            "id": "property-1",
            "title": "Квартира 83",
            "address": "Соколовская 72, кв. 83",
            "meters": [{"kind": "cold_water", "contour": "кухня", "serial_number": "123456"}],
        }
        api_result = {"data": {"planned": [{"consumption": 1, "amount": 38.06, "tariff": 38.06, "unit": "м³", "warnings": []}]}}
        with (
            patch("housepro_meter_readings.integration._existing_pending", return_value=None),
            patch("housepro_meter_readings.integration._capture_attachments", return_value=[{"type": "telegram", "file_id": "f"}]),
            patch("housepro_meter_readings.integration._resolve_property", return_value=property_data),
            patch("housepro_meter_readings.integration._crm_json", return_value=api_result),
            patch("housepro_meter_readings.integration._stage_pending", return_value="A1B2C3D4"),
        ):
            preview = _process_submission(event, "-1004299917388", "99", "42", "manager", "1001")
        self.assertIn("ПОДТВЕРДИТЬ A1B2C3D4", preview)
        self.assertNotIn("{CODE}", preview)

    def test_parses_append_only_correction_reason(self):
        parsed = parse_submission(
            "Квартира: Соколовская 72\n"
            "Дата: 23.11.2026\n"
            "Исправление: Ошиблась в последней цифре, сверила с фото\n"
            "ХВС | Контур: кухня | Счётчик: 123456 | Показание: 12,345"
        )
        self.assertEqual(parsed["correction_reason"], "Ошиблась в последней цифре, сверила с фото")

    def test_preview_sends_correction_reason_to_crm(self):
        from housepro_meter_readings.integration import _process_submission

        event = type("Event", (), {
            "text": "Квартира: Соколовская 72\n"
                    "Дата: 23.11.2026\n"
                    "Исправление: Ошиблась в последней цифре, сверила с фото\n"
                    "ХВС | Контур: кухня | Счётчик: 123456 | Показание: 12,345",
        })()
        property_data = {
            "id": "property-1",
            "title": "Квартира 83",
            "address": "Соколовская 72, кв. 83",
            "meters": [{"kind": "cold_water", "contour": "кухня", "serial_number": "123456"}],
        }
        api_result = {"data": {"planned": [{"consumption": 1, "amount": 38.06, "tariff": 38.06, "unit": "м³", "warnings": []}]}}
        with (
            patch("housepro_meter_readings.integration._existing_pending", return_value=None),
            patch("housepro_meter_readings.integration._capture_attachments", return_value=[{"type": "telegram", "file_id": "f"}]),
            patch("housepro_meter_readings.integration._resolve_property", return_value=property_data),
            patch("housepro_meter_readings.integration._crm_json", return_value=api_result) as crm_json,
            patch("housepro_meter_readings.integration._stage_pending", return_value="A1B2C3D4"),
        ):
            _process_submission(event, "-1004299917388", "99", "42", "manager", "1001")
        payload = crm_json.call_args.args[2]
        self.assertEqual(payload["correction_reason"], "Ошиблась в последней цифре, сверила с фото")

    def test_expired_pending_draft_removes_copied_photo(self):
        import os
        import tempfile
        from pathlib import Path

        from housepro_meter_readings.integration import _db_session, _existing_pending, _stage_pending

        with tempfile.TemporaryDirectory() as temp_home:
            with patch.dict(os.environ, {"HERMES_HOME": temp_home}):
                photo_dir = Path(temp_home) / "cache" / "inbound"
                photo_dir.mkdir(parents=True)
                photo = photo_dir / "photo.jpg"
                photo.write_bytes(b"test-image")
                token = _stage_pending(
                    "-1004299917388", "99", "42", "@manager", "1002",
                    {"reading_date": "2026-11-23"},
                    [{"type": "path", "path": str(photo), "mime": "image/jpeg", "filename": "photo.jpg"}],
                    "preview {CODE}",
                )
                with _db_session() as db:
                    db.execute("UPDATE pending SET expires_at=1 WHERE token=?", (token,))
                self.assertIsNone(_existing_pending("-1004299917388", "99", "42"))
                self.assertFalse(photo.exists())

    def test_pre_dispatch_runs_topic_work_off_gateway_event_loop(self):
        import os
        import threading
        from types import SimpleNamespace
        from housepro_meter_readings import pre_gateway_dispatch

        main_thread = threading.get_ident()
        worker_threads = []
        event = SimpleNamespace(
            source=SimpleNamespace(
                platform="telegram", chat_id="-1004299917388", thread_id="99", user_id="42",
            ),
            message_id="2000",
            text="status",
        )
        self.assertTrue(inspect.iscoroutinefunction(pre_gateway_dispatch), "pre-dispatch network work must be awaitable")
        if not inspect.iscoroutinefunction(pre_gateway_dispatch):
            return

        def handle(*args):
            worker_threads.append(threading.get_ident())
            return "preview"

        def send(*args):
            worker_threads.append(threading.get_ident())
            return True

        with (
            patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "42"}),
            patch("housepro_meter_readings.integration._handle_topic_event", side_effect=handle),
            patch("housepro_meter_readings.integration._send_reply", side_effect=send),
        ):
            result = asyncio.run(pre_gateway_dispatch(event, gateway=None, session_store=None))
        self.assertEqual(result, {"action": "skip"})
        self.assertEqual(len(worker_threads), 2)
        self.assertTrue(all(thread_id != main_thread for thread_id in worker_threads))

    def test_unauthorized_sender_cannot_trigger_meter_processing(self):
        import os
        from housepro_meter_readings import pre_gateway_dispatch

        event = type("Event", (), {
            "source": type("Source", (), {
                "platform": "telegram",
                "chat_id": "-1004299917388",
                "thread_id": "99",
                "user_id": "999",
                "user_name": "stranger",
            })(),
            "message_id": "2001",
            "text": "неверный отправитель",
        })()
        with (
            patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "42, 43"}),
            patch("housepro_meter_readings.integration._handle_topic_event") as handle,
            patch("housepro_meter_readings.integration._send_reply") as send_reply,
        ):
            result = asyncio.run(pre_gateway_dispatch(event, gateway=None, session_store=None))
        self.assertEqual(result, {"action": "skip"})
        handle.assert_not_called()
        self.assertIn("уполномоченным", send_reply.call_args.args[1])

    def test_authorized_sender_can_reach_meter_flow(self):
        import os
        from housepro_meter_readings import pre_gateway_dispatch

        event = type("Event", (), {
            "source": type("Source", (), {
                "platform": "telegram",
                "chat_id": "-1004299917388",
                "thread_id": "99",
                "user_id": "42",
                "user_name": "manager",
            })(),
            "message_id": "2002",
            "text": "информация",
        })()
        with (
            patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "42, 43"}),
            patch("housepro_meter_readings.integration._handle_topic_event", return_value="preview") as handle,
            patch("housepro_meter_readings.integration._send_reply") as send_reply,
        ):
            result = asyncio.run(pre_gateway_dispatch(event, gateway=None, session_store=None))
        self.assertEqual(result, {"action": "skip"})
        handle.assert_called_once()
        send_reply.assert_called_once_with(event, "preview", None)

    def test_photo_uploads_run_concurrently_and_preserve_order(self):
        import threading
        import housepro_meter_readings.integration as integration

        upload_photos = getattr(integration, "_upload_photos", None)
        self.assertTrue(callable(upload_photos), "photo batches need a bounded concurrent uploader")
        if not callable(upload_photos):
            return

        barrier = threading.Barrier(3)
        attachments = [{"filename": f"{index}.jpg"} for index in range(3)]

        def upload(item, gateway=None):
            barrier.wait(timeout=1)
            return "url:" + item["filename"]

        with patch("housepro_meter_readings.integration._upload_photo", side_effect=upload):
            urls = upload_photos(attachments)
        self.assertEqual(urls, ["url:0.jpg", "url:1.jpg", "url:2.jpg"])

    def test_crm_post_identifies_telegram_requester_for_audit(self):
        import os
        from housepro_meter_readings.integration import _crm_json

        payload = {
            "source": "telegram",
            "telegram": {
                "user_id": 42,
                "username": "@manager",
                "chat_id": -1004299917388,
                "thread_id": 99,
                "message_id": 3003,
            },
            "dry_run": True,
        }
        with (
            patch.dict(os.environ, {"HOUSEPRO_BOT_API_KEY": "hp_test-key"}),
            patch("housepro_meter_readings.integration._open_direct", return_value=(200, b'{"data":{"preview":true}}', "application/json")) as open_direct,
        ):
            _crm_json("POST", "", payload)
        request = open_direct.call_args.args[0]
        self.assertEqual(request.get_header("X-bot-requester"), "tg:42:@manager")

    def test_telegram_proxy_is_read_from_active_gateway_configuration(self):
        from types import SimpleNamespace
        import housepro_meter_readings.integration as integration

        platform_config = SimpleNamespace(extra={"proxy_url": "socks5://127.0.0.1:10809"})
        config = SimpleNamespace(platforms={"telegram": platform_config})
        gateway = SimpleNamespace(config=config)
        helper = getattr(integration, "_telegram_proxy_url", None)
        self.assertTrue(callable(helper), "meter Telegram requests must have a configured proxy resolver")
        if callable(helper):
            self.assertEqual(helper(gateway), "socks5://127.0.0.1:10809")

    def test_telegram_http_client_uses_gateway_proxy_and_ignores_environment_proxy(self):
        import os
        from types import SimpleNamespace
        from urllib.request import Request
        from unittest.mock import MagicMock
        import httpx
        from housepro_meter_readings.integration import _open_telegram

        proxy = "socks5://127.0.0.1:10809"
        gateway = SimpleNamespace(config=SimpleNamespace(
            platforms={"telegram": SimpleNamespace(extra={"proxy_url": proxy})},
        ))
        response = SimpleNamespace(
            status_code=200,
            content=b'{"ok":true}',
            headers={"Content-Type": "application/json"},
        )
        client = MagicMock()
        client.__enter__.return_value.request.return_value = response
        request = Request("https://api.telegram.org/bot123456:test-token/getMe")

        with (
            patch.dict(os.environ, {"HTTPS_PROXY": "http://wrong-proxy.invalid:8080"}),
            patch.object(httpx, "Client", return_value=client) as create_client,
        ):
            status, body, content_type = _open_telegram(request, gateway)
        create_client.assert_called_once_with(proxy=proxy, timeout=6.0, trust_env=False)
        client.__enter__.return_value.request.assert_called_once()
        self.assertEqual((status, body, content_type), (200, b'{"ok":true}', "application/json"))

    def test_telegram_reply_uses_proxy_transport(self):
        import os
        from types import SimpleNamespace
        from housepro_meter_readings.integration import _send_reply

        event = SimpleNamespace(
            source=SimpleNamespace(chat_id="-1004299917388", thread_id="99"),
            message_id="2100",
        )
        with (
            patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "123456:test-token"}),
            patch("housepro_meter_readings.integration._open_telegram", return_value=(200, b'{"ok":true}', "application/json"), create=True) as proxy_open,
            patch("housepro_meter_readings.integration._open_direct", return_value=(200, b'{"ok":true}', "application/json")) as direct_open,
        ):
            sent = _send_reply(event, "Проверка")
        self.assertTrue(sent)
        proxy_open.assert_called_once()
        direct_open.assert_not_called()

    def test_confirm_retry_recognizes_existing_reading_before_reupload(self):
        import os
        import tempfile
        from housepro_meter_readings.integration import (
            _db_session,
            _fetch_pending,
            _save_confirmed,
            _stage_pending,
        )

        response = {
            "data": {
                "property": "Соколовская 72, кв. 83",
                "reading_date": "2026-11-23",
                "planned": [{"duplicate": True, "label": "ХВС · кухня"}],
            }
        }
        with tempfile.TemporaryDirectory() as temp_home:
            with patch.dict(os.environ, {"HERMES_HOME": temp_home}):
                token = _stage_pending(
                    "-1004299917388", "99", "42", "@manager", "3001",
                    {
                        "property_id": "property-1",
                        "reading_date": "2026-11-23",
                        "readings": [{"kind": "cold_water", "contour": "кухня", "value": 12.345}],
                        "source": "telegram",
                        "telegram": {"user_id": 42, "chat_id": -1004299917388, "thread_id": 99, "message_id": 3001},
                        "dry_run": True,
                    },
                    [{"type": "telegram", "file_id": "already-copied", "mime": "image/jpeg", "filename": "photo.jpg"}],
                    "preview {CODE}",
                )
                with (
                    patch("housepro_meter_readings.integration._crm_json", return_value=response) as crm_json,
                    patch("housepro_meter_readings.integration._upload_photos", create=True) as upload_photos,
                    patch("housepro_meter_readings.integration._upload_photo") as upload_photo,
                ):
                    reply = _save_confirmed(None, token, "-1004299917388", "99", "42")
                self.assertIn("уже записано", reply.casefold())
                upload_photos.assert_not_called()
                upload_photo.assert_not_called()
                self.assertEqual(crm_json.call_count, 1)
                with _db_session() as db:
                    stored = _fetch_pending(token, "-1004299917388", "99")
                self.assertIsNotNone(stored)
                if stored is not None:
                    self.assertEqual(stored["committed_reply"], reply)

    def test_retry_reuses_uploaded_photos_after_crm_timeout(self):
        import json
        import os
        import tempfile
        from housepro_meter_readings.integration import MeterFlowError, _fetch_pending, _save_confirmed, _stage_pending

        preview = {"data": {
            "property": "Соколовская 72, кв. 83",
            "reading_date": "2026-11-23",
            "planned": [{"duplicate": False, "label": "ХВС · кухня"}],
            "errors": [],
        }}
        committed = {"data": {
            "property": "Соколовская 72, кв. 83",
            "reading_date": "2026-11-23",
            "planned": [{"duplicate": False, "label": "ХВС · кухня"}],
            "saved": ["ХВС · кухня: 12,345"],
            "skipped": [],
            "total_utilities": 0,
        }}
        with tempfile.TemporaryDirectory() as temp_home:
            with patch.dict(os.environ, {"HERMES_HOME": temp_home}):
                token = _stage_pending(
                    "-1004299917388", "99", "42", "@manager", "3002",
                    {
                        "property_id": "property-1",
                        "reading_date": "2026-11-23",
                        "readings": [{"kind": "cold_water", "contour": "кухня", "value": 12.345}],
                        "source": "telegram",
                        "telegram": {"user_id": 42, "chat_id": -1004299917388, "thread_id": 99, "message_id": 3002},
                        "dry_run": True,
                    },
                    [{"type": "telegram", "file_id": "file-id", "mime": "image/jpeg", "filename": "photo.jpg"}],
                    "preview {CODE}",
                )
                with (
                    patch("housepro_meter_readings.integration._crm_json", side_effect=[preview, MeterFlowError("timeout"), preview, committed]) as crm_json,
                    patch("housepro_meter_readings.integration._upload_photos", return_value=["https://storage.example/photo.jpg"]) as upload_photos,
                ):
                    with self.assertRaises(MeterFlowError):
                        _save_confirmed(None, token, "-1004299917388", "99", "42")
                    stored = _fetch_pending(token, "-1004299917388", "99")
                    self.assertIsNotNone(stored)
                    if stored is not None:
                        self.assertEqual(json.loads(stored["payload_json"])["photo_urls"], ["https://storage.example/photo.jpg"])
                    reply = _save_confirmed(None, token, "-1004299917388", "99", "42")
                self.assertIn("Записано в HousePro CRM", reply)
                self.assertEqual(crm_json.call_count, 4)
                upload_photos.assert_called_once()

    def test_only_exact_telegram_topic_is_targeted(self):
        self.assertTrue(is_target_event("telegram", "-1004299917388", "99"))
        self.assertFalse(is_target_event("telegram", "-1004299917388", "98"))
        self.assertFalse(is_target_event("telegram", "-1001", "99"))
        self.assertFalse(is_target_event("discord", "-1004299917388", "99"))


if __name__ == "__main__":
    unittest.main()
