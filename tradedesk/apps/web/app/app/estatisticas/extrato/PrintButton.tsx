'use client';
export default function PrintButton() {
  return <button onClick={() => window.print()} className="rounded border border-black px-3 py-1">Imprimir / salvar PDF</button>;
}
