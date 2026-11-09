"""b) Fluxo de ordens como CONFIRMAÇÃO de entrada: saldo de agressores (times & trades) e desequilíbrio do book."""
from __future__ import annotations


def confirms(side: str, flow: dict | None, min_imbalance: float = 0.10, use_book: bool = True, min_book: float = 0.05) -> tuple[bool, str]:
    """Compra só se os agressores compradores dominam (e o book não é contra); venda, o espelho. Sem dados → NÃO confirma (e diz por quê)."""
    if not flow or flow.get("trades", 0) < 5:
        return False, "sem fluxo de ordens suficiente (times & trades)"
    sign = 1 if side == "buy" else -1
    imb = flow["imbalance"] * sign
    if imb < min_imbalance:
        return False, f"fluxo contra/neutro (saldo de agressores {flow['imbalance']:+.2f})"
    if use_book and flow.get("book_imbalance", 0) * sign < min_book:
        return False, f"book não confirma ({flow.get('book_imbalance', 0):+.2f})"
    return True, f"fluxo confirma (agressores {flow['imbalance']:+.2f}, book {flow.get('book_imbalance', 0):+.2f})"
