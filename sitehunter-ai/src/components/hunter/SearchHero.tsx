"use client";
import { useEffect } from "react";
import { arcRuntime } from "@/lib/site/immersive/arcRuntime";

/**
 * Faixa de abertura da busca: o mesmo arco de luz dos sites gerados, em azul da marca, atrás do título.
 * Canvas leve (30 quadros/s, pausa fora da tela, um quadro só com "reduzir movimento"), sempre sobre um
 * gradiente CSS estático. Decorativo (aria-hidden): não atrapalha a leitura nem a busca.
 */
export function SearchHero() {
  useEffect(() => {
    const stop = arcRuntime({ canvas: "[data-arc-hunter]", panel: null, apexRatio: 0.78, hero: "[data-hunter-hero]", kind: "neon", dark: true, bg: "#04060b", c: ["#dbeafe", "#60a5fa", "#1d4ed8"] });
    return stop;
  }, []);
  return (
    <section data-hunter-hero className="hunter-hero" aria-labelledby="hh-title">
      <div className="hunter-hero-fx" aria-hidden="true"><canvas data-arc-hunter /></div>
      <div className="hunter-hero-copy">
        <p className="hunter-eyebrow"><i aria-hidden="true" />Prospecção com dados públicos</p>
        <h2 id="hh-title">Encontre empresas, veja como falar com cada uma e abra o site pensado para o ramo dela.</h2>
        <ul className="hunter-points" aria-label="Como o Hunter trabalha">
          <li><b>Telefone basta</b><span>WhatsApp só quando a fonte informa</span></li>
          <li><b>Aberta ou fechada</b><span>só com horário publicado, no fuso local</span></li>
          <li><b>Nada é enviado</b><span>você revisa e fala com a empresa</span></li>
        </ul>
      </div>
    </section>
  );
}
