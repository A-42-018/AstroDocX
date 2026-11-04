"""Endpoint tests with a mocked Anthropic client. Run: python -m pytest tools/vita/test (or python -m unittest discover)."""
import io
import json
import os
import sys
import unittest
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "api"))
import _vita as v  # noqa: E402

KB = v.load_knowledge()
GOOD = next(u for u in KB.by_url if "ochmo-tb-004" in u)


def reply(obj=None, text=None, stop="end_turn"):
    t = text if text is not None else json.dumps(obj)
    return NS(stop_reason=stop, content=[NS(type="thinking", thinking=""), NS(type="text", text=t)])


class Mock:
    def __init__(self, r):
        self.r, self.calls = r, []
        self.messages = NS(create=self.create)

    def create(self, **kw):
        self.calls.append(kw)
        if callable(self.r):
            return self.r()
        return self.r


def mk(client, env=None, limiter=None):
    env = {"ANTHROPIC_API_KEY": "test-key"} if env is None else env
    lim = limiter or v.make_limiter({"per_minute": 99, "per_hour": 99, "daily_cap": 99})
    return v.Vita(get_client=lambda e: client, kb=KB, env=env, limiter=lim)


def post(h, body, headers=None):
    raw = body if isinstance(body, bytes) else json.dumps(body).encode()
    return h.handle("POST", {"x-forwarded-for": "1.1.1.1", **(headers or {})}, raw)


class Validation(unittest.TestCase):
    def test_citations_dropped_and_labels_from_kb(self):
        r = v.validate_reply({"covered": True, "text": "ok", "citations": [{"url": GOOD}, {"url": "https://example.com/made-up"}, {"url": GOOD}, {"url": "https://www.nasa.gov/invented"}], "actions": []}, KB)
        self.assertEqual(r["citations"], [{"label": KB.by_url[GOOD], "url": GOOD}])
        self.assertEqual(r["source"], "live")

    def test_action_targets(self):
        acts = [
            {"label": "a", "kind": "console", "target": "/alerts"}, {"label": "b", "kind": "console", "target": "/admin"},
            {"label": "c", "kind": "console", "target": "/board?x=<script>"}, {"label": "d", "kind": "console", "target": "/board?crew=pilot"},
            {"label": "e", "kind": "library", "target": "moon"}, {"label": "f", "kind": "library", "target": "twins-study"},
            {"label": "g", "kind": "cabin", "target": "secret"}, {"label": "h", "kind": "cabin", "target": "eva"},
            {"label": "i", "kind": "tour", "target": "x"}, {"label": "j", "kind": "weird", "target": ""}, None, "str",
        ]
        r = v.validate_reply({"text": "ok", "citations": [], "actions": acts}, KB)
        self.assertEqual([f"{a['kind']}:{a['target']}" for a in r["actions"]], ["console:/alerts", "console:/board?crew=pilot"])
        r2 = v.validate_reply({"text": "ok", "citations": [], "actions": acts[4:9]}, KB)
        self.assertEqual([f"{a['kind']}:{a['target']}" for a in r2["actions"]], ["library:twins-study", "cabin:eva"])

    def test_not_covered_and_garbage(self):
        self.assertEqual(v.validate_reply({"covered": False, "text": "No.", "citations": [{"url": GOOD}], "actions": []}, KB)["citations"], [])
        self.assertIsNone(v.validate_reply({"text": "   "}, KB))
        self.assertIsNone(v.validate_reply(None, KB))
        self.assertEqual(v.clean_text("a <b>b</b> <em>c</em> <img src=x onerror=1> d </em><em>e"), "a b <em>c</em> d <em>e</em>")

    def test_parse_model_json(self):
        self.assertEqual(v.parse_model_json('{"a":1}'), {"a": 1})
        self.assertEqual(v.parse_model_json('```json\n{"a":1}\n```'), {"a": 1})
        self.assertEqual(v.parse_model_json('Sure! {"a":1} done'), {"a": 1})
        self.assertIsNone(v.parse_model_json("not json"))

    def test_parse_input(self):
        self.assertIn("error", v.parse_input({}))
        self.assertIn("error", v.parse_input({"question": "x" * 501}))
        self.assertIn("error", v.parse_input({"question": "hi", "history": "x"}))
        long = [{"role": "assistant" if i % 2 else "user", "text": f"m{i}"} for i in range(20)]
        p = v.parse_input({"question": "now", "history": long})
        self.assertLessEqual(len(p["messages"]), 7)
        self.assertEqual(p["messages"][0]["role"], "user")
        self.assertEqual(p["messages"][-1]["content"], "now")
        for a, b in zip(p["messages"], p["messages"][1:]):
            self.assertNotEqual(a["role"], b["role"])

    def test_limiter(self):
        t = [0]
        allow = v.make_limiter({"per_minute": 2, "per_hour": 100, "daily_cap": 100}, lambda: t[0])
        self.assertTrue(allow("a")); self.assertTrue(allow("a")); self.assertFalse(allow("a")); self.assertTrue(allow("b"))
        t[0] = 61
        self.assertTrue(allow("a"))
        cap = v.make_limiter({"per_minute": 99, "per_hour": 99, "daily_cap": 1}, lambda: 0)
        self.assertTrue(cap("a")); self.assertFalse(cap("b"))

    def test_system_prompt(self):
        s = v.system_prompt(KB)
        for c in KB.chunks:
            self.assertIn(c["url"], s)
        for pat in ("never diagnose", "120 words", "NASA endorses", "ONE JSON object"):
            self.assertIn(pat, s)


class Handler(unittest.TestCase):
    def test_503_without_key_never_makes_client(self):
        made = []
        h = v.Vita(get_client=lambda e: made.append(1), kb=KB, env={})
        self.assertEqual(post(h, {"question": "hi"})[0], 503)
        self.assertEqual(made, [])

    def test_405_400_413(self):
        h = mk(Mock(reply({})))
        s, hdr, _ = h.handle("GET", {}, b"")
        self.assertEqual((s, hdr.get("Allow")), (405, "POST"))
        self.assertEqual(post(h, {"question": ""})[0], 400)
        self.assertEqual(post(h, b"not json")[0], 400)
        self.assertEqual(post(h, {"question": "x"}, {"content-length": "999999"})[0], 413)
        self.assertEqual(post(h, b"x" * 20000)[0], 413)

    def test_200_and_request_shape(self):
        c = Mock(reply({"covered": True, "text": "CO2 is limited to <em>3 mmHg</em>.", "citations": [{"url": GOOD}, {"url": "https://evil.example/x"}],
                        "actions": [{"label": "Sim", "kind": "console", "target": "/simulator"}, {"label": "X", "kind": "console", "target": "/nope"}]}))
        s, _, b = post(mk(c), {"question": "What is the CO2 limit?", "history": [{"role": "user", "text": "hi"}, {"role": "assistant", "text": "hello"}]})
        self.assertEqual(s, 200)
        self.assertEqual(b, {"text": "CO2 is limited to <em>3 mmHg</em>.", "citations": [{"label": KB.by_url[GOOD], "url": GOOD}],
                             "actions": [{"label": "Sim", "kind": "console", "target": "/simulator"}], "source": "live"})
        p = c.calls[0]
        self.assertEqual(p["model"], "claude-haiku-5-5")
        self.assertEqual(p["max_tokens"], v.LIMITS["max_tokens"])
        self.assertEqual(p["system"][0]["cache_control"], {"type": "ephemeral"})
        self.assertEqual(p["timeout"], v.LIMITS["timeout_s"])
        self.assertNotIn("output_config", p)  # the gateway ignores it; JSON is requested in the prompt
        self.assertEqual(len(p["messages"]), 3)
        self.assertEqual(p["messages"][-1]["content"], "What is the CO2 limit?")

    def test_fenced_json_accepted(self):
        s, _, b = post(mk(Mock(reply(text='```json\n{"covered":true,"text":"hi","citations":[],"actions":[]}\n```'))), {"question": "q"})
        self.assertEqual((s, b["text"]), (200, "hi"))

    def test_model_env_override(self):
        c = Mock(reply({"text": "a"}))
        post(mk(c, {"ANTHROPIC_API_KEY": "k", "VITA_MODEL": "claude-x"}), {"question": "q"})
        self.assertEqual(c.calls[0]["model"], "claude-x")

    def test_502_cases_leak_nothing(self):
        def boom():
            raise RuntimeError("secret sk-ant-123")
        bad = [boom, lambda: reply(stop="refusal"), lambda: reply(text="{", stop="max_tokens"), lambda: reply(text="not json"),
               lambda: reply({"covered": True, "text": "", "citations": [], "actions": []})]
        for f in bad:
            s, _, b = post(mk(Mock(f)), {"question": "hi"})
            self.assertEqual(s, 502)
            self.assertNotIn("sk-ant", json.dumps(b))

    def test_429(self):
        h = mk(Mock(reply({"text": "a"})), limiter=v.make_limiter({"per_minute": 1, "per_hour": 9, "daily_cap": 9}))
        self.assertEqual(post(h, {"question": "a"})[0], 200)
        s, hdr, _ = post(h, {"question": "a"})
        self.assertEqual((s, hdr["Retry-After"]), (429, "60"))

    def test_client_uses_base_url_and_no_retries(self):
        c = v.default_get_client({"ANTHROPIC_API_KEY": "k", "ANTHROPIC_BASE_URL": "https://gw.example"})
        self.assertEqual(str(c.base_url).rstrip("/"), "https://gw.example")
        self.assertEqual(c.max_retries, 0)

    def test_http_handler_class(self):
        import ask  # api/ask.py
        self.assertTrue(issubclass(ask.handler, ask.BaseHTTPRequestHandler))


if __name__ == "__main__":
    unittest.main()
