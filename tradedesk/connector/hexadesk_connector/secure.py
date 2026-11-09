"""Credenciais da corretora SÓ nesta máquina, criptografadas com a conta do Windows (DPAPI).
Quem copiar o arquivo para outro PC/usuário não consegue abrir. Nunca vão para o site nem para o banco."""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

FILE = "secrets.bin"


def _dpapi(data: bytes, protect: bool) -> bytes:
    import ctypes
    from ctypes import wintypes as wt

    class BLOB(ctypes.Structure):
        _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    buf = ctypes.create_string_buffer(data, len(data))
    inb = BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    out = BLOB()
    fn = ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    ok = fn(ctypes.byref(inb), None, None, None, None, 0, ctypes.byref(out))
    if not ok:
        raise OSError("DPAPI falhou (arquivo de outro usuário/PC?)")
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out.pbData)


def protect(data: bytes) -> bytes:
    if sys.platform == "win32":
        return _dpapi(data, True)
    if os.environ.get("HEXADESK_DEV") == "1":  # SÓ para testes fora do Windows — NÃO é seguro
        return b"DEV:" + base64.b64encode(data)
    raise RuntimeError("Criptografia local só no Windows (DPAPI).")


def unprotect(data: bytes) -> bytes:
    if sys.platform == "win32":
        return _dpapi(data, False)
    if os.environ.get("HEXADESK_DEV") == "1" and data.startswith(b"DEV:"):
        return base64.b64decode(data[4:])
    raise RuntimeError("Criptografia local só no Windows (DPAPI).")


def save_secrets(state_dir: Path, secrets: dict) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / FILE).write_bytes(protect(json.dumps(secrets).encode()))


def load_secrets(state_dir: Path) -> dict:
    p = state_dir / FILE
    return json.loads(unprotect(p.read_bytes())) if p.exists() else {}
