import os
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["HEXADESK_DEV"] = "1"

from hexadesk_connector.calendar_b3 import add_business_days, easter, is_business_day  # noqa: E402
from hexadesk_connector.contracts import current_contract, parse_symbol, win_expiry, wdo_expiry  # noqa: E402
from hexadesk_connector.fake_mt5 import WDO_SPEC, WIN_SPEC  # noqa: E402
from hexadesk_connector.risk import day_state, size_contracts  # noqa: E402
from hexadesk_connector.secure import load_secrets, save_secrets  # noqa: E402
from hexadesk_connector.strategy import baseline_signal  # noqa: E402


class Calendar(unittest.TestCase):
    def test_easter_and_moveable_holidays_2026(self):
        self.assertEqual(easter(2026), date(2026, 4, 5))
        self.assertFalse(is_business_day(date(2026, 4, 3)))   # Sexta-feira Santa
        self.assertFalse(is_business_day(date(2026, 2, 16)))  # Carnaval
        self.assertFalse(is_business_day(date(2026, 2, 17)))
        self.assertFalse(is_business_day(date(2026, 6, 4)))   # Corpus Christi
        self.assertTrue(is_business_day(date(2026, 4, 6)))
        self.assertFalse(is_business_day(date(2026, 11, 7)))  # sábado

    def test_extra_holiday(self):
        self.assertFalse(is_business_day(date(2026, 3, 10), (date(2026, 3, 10),)))

    def test_add_business_days_skips_holidays(self):
        self.assertEqual(add_business_days(date(2026, 4, 2), 1), date(2026, 4, 6))  # pula Sexta Santa e fim de semana


class Contracts(unittest.TestCase):
    def test_expiries(self):
        self.assertEqual(win_expiry(2026, 6), date(2026, 6, 17))   # quarta mais próxima do dia 15
        self.assertEqual(wdo_expiry(2026, 11), date(2026, 11, 3))  # 1º dia útil (2/nov é feriado)

    def test_current_contract_and_roll(self):
        self.assertEqual(current_contract("WIN", date(2026, 11, 9), roll_days=2), "WINZ26")
        self.assertEqual(current_contract("WDO", date(2026, 11, 9), roll_days=1), "WDOZ26")
        self.assertEqual(current_contract("WDO", date(2026, 10, 20), roll_days=1), "WDOX26")
        self.assertEqual(current_contract("WIN", date(2026, 6, 12), roll_days=2), "WINM26")  # antes da rolagem
        self.assertEqual(current_contract("WIN", date(2026, 6, 15), roll_days=2), "WINQ26")  # rolou

    def test_respects_available_symbols(self):
        self.assertEqual(current_contract("WIN", date(2026, 6, 12), roll_days=2, available=["WINQ26"]), "WINQ26")

    def test_year_change(self):
        self.assertEqual(current_contract("WIN", date(2026, 12, 20), roll_days=2), "WING27")
        self.assertEqual(parse_symbol("WINZ26"), ("WIN", 2026, 12))
        self.assertIsNone(parse_symbol("PETR4"))


class Risk(unittest.TestCase):
    def test_sizing(self):
        self.assertEqual(size_contracts(10_000, "moderado", 60, 150, WIN_SPEC, 3), 2)   # risco 60 / (150 pts × R$0,20) = 2
        self.assertEqual(size_contracts(10_000, "moderado", 60, 5, WDO_SPEC, 3), 1)     # 60 / (5 × R$10) = 1
        self.assertEqual(size_contracts(10_000, "moderado", 600, 150, WIN_SPEC, 3), 3)  # limitado por max_contracts
        self.assertEqual(size_contracts(10_000, "conservador", 600, 150, WIN_SPEC, 9), 1)  # 0,5% = 50 → 1 contrato
        self.assertEqual(size_contracts(100, "conservador", 600, 150, WIN_SPEC, 9), 0)     # saldo pequeno demais
        self.assertEqual(size_contracts(0, "moderado", 60, 150, WIN_SPEC, 3), 0)

    def test_day_state(self):
        self.assertEqual(day_state(-150, 150, None), "loss")
        self.assertEqual(day_state(-149.9, 150, None), "ok")
        self.assertEqual(day_state(300, 150, 300), "target")
        self.assertEqual(day_state(300, 150, None), "ok")


class Strategy(unittest.TestCase):
    def test_baseline_cross(self):
        down = [(i, 0, 0, 0, 200 - i, 0) for i in range(60)]
        up = [(60 + i, 0, 0, 0, 140 + i * 3, 0) for i in range(30)]
        sigs = [baseline_signal(down + up[: k + 1]) for k in range(len(up))]
        self.assertTrue(any(s and s[0] == "buy" for s in sigs))
        self.assertIsNone(baseline_signal(down[:10]))


class Secure(unittest.TestCase):
    def test_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            save_secrets(Path(d), {"demo": {"login": 1, "password": "x", "server": "ClearInvestimentos-DEMO"}})
            self.assertEqual(load_secrets(Path(d))["demo"]["server"], "ClearInvestimentos-DEMO")
            raw = (Path(d) / "secrets.bin").read_bytes()
            self.assertNotIn(b"ClearInvestimentos", raw)   # não fica em texto puro no disco
            self.assertNotIn(b"password", raw)


if __name__ == "__main__":
    unittest.main()
