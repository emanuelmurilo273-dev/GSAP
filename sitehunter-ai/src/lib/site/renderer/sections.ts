// Seções dos sites gerados. Cada seção vazia é omitida (nada de blocos sem conteúdo).
import type { Section, SiteContent } from "../types";
import { icon } from "../icons";
import { esc, paras, safeUrl, telHref, waNumber } from "./util";
import { animatedWords, button, creditText, directionsUrl, mapsUrl, picture, pictureTag, sectionHead, whatsappUrl, type RenderCtx } from "./components";

type Of<T extends Section["type"]> = Extract<Section, { type: T }>;

function heroCard(c: SiteContent): string {
  const find = <T extends Section["type"]>(t: T) => c.sections.find((x) => x.type === t && x.visible) as Of<T> | undefined;
  const menu = find("menu");
  const svc = find("services");
  const prod = find("products");
  const hours = find("hours");
  let title = "";
  let rows: { name: string; meta: string }[] = [];
  if (menu && menu.categories.some((k) => k.items.length)) {
    title = "Do nosso cardápio";
    rows = menu.categories.flatMap((k) => k.items.map((i) => ({ name: i.name, meta: i.price || k.name }))).slice(0, 4);
  } else if (svc?.items.length) {
    title = svc.title || "Serviços";
    rows = svc.items.slice(0, 4).map((i) => ({ name: i.title, meta: i.price || "" }));
  } else if (prod?.items.length) {
    title = prod.title || "Destaques";
    rows = prod.items.slice(0, 4).map((i) => ({ name: i.name, meta: "" }));
  }
  if (!rows.length) return "";
  const lines = hours?.lines.filter((l) => l.value.trim()) ?? [];
  return `<aside class="hero-card" aria-label="${esc(title)}"><div class="hc-head"><span class="hc-badge" aria-hidden="true">${icon(c.icon)}</span><div><p class="hc-name">${esc(c.siteName)}</p><p class="hc-sub">${esc(title)}</p></div></div><ul>${rows
    .map((r, i) => `<li style="--i:${i}"><span>${esc(r.name)}</span>${r.meta ? `<em>${esc(r.meta)}</em>` : ""}</li>`)
    .join("")}</ul>${
    lines.length
      ? `<p class="hc-foot" data-hours='${esc(JSON.stringify(lines))}'>${icon("clock", "ci")}<span class="hc-today">Veja nossos horários</span></p>`
      : `<p class="hc-foot">${icon("chat", "ci")}<span>Atendimento pelo WhatsApp</span></p>`
  }</aside>`;
}

function hero(s: Of<"hero">, ctx: RenderCtx, next?: Section): string {
  const { c } = ctx;
  const src = s.image?.url ? safeUrl(s.image.url) : "#";
  const hasImg = src !== "#";
  const addr = c.business.address ? c.business.address.split(" - ").slice(-2).join(" - ").slice(0, 60) : "";
  const chips = [
    addr && `<li class="chip">${icon("pin", "ci")}${esc(addr)}</li>`,
    c.business.phone && `<li class="chip">${icon("phone", "ci")}${esc(c.business.phone)}</li>`,
  ].filter(Boolean);

  return `<section id="${esc(s.id)}" class="hero${hasImg ? " has-img" : ""}" aria-labelledby="${esc(s.id)}-t">
  <div class="hero-bg" aria-hidden="true">${hasImg ? pictureTag({ ...s.image!, alt: "" }, { sizes: "100vw", width: 1600, ratio: [16, 9], eager: true, cls: "hero-pic" }) : ""}<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="pattern"></div></div>
  <div class="wrap hero-grid">
    <div class="hero-inner">
      ${c.tagline ? `<p class="eyebrow hero-eyebrow">${icon(c.icon, "ei")}${esc(c.tagline)}</p>` : ""}
      <h1 id="${esc(s.id)}-t">${animatedWords(s.title)}</h1>
      <p class="lead">${esc(s.subtitle)}</p>
      ${s.buttons.length ? `<div class="actions">${s.buttons.map((b, i) => button(b, c, i === 0 ? "main" : "ghost", i === 0 ? "btn-lg" : "btn-lg")).join("")}</div>` : ""}
      ${chips.length ? `<ul class="chips" aria-label="Informações rápidas">${chips.join("")}</ul>` : ""}
    </div>
    ${heroCard(c)}
  </div>
  ${next ? `<a class="scroll-cue" href="#${esc(next.id)}"><span class="sr-only">Ir para a próxima seção</span><span aria-hidden="true"></span></a>` : ""}
  ${hasImg && s.image?.credit ? `<p class="hero-credit">${esc(creditText(s.image))}</p>` : ""}${hasImg && s.image?.alt ? `<p class="sr-only">${esc(s.image.alt)}</p>` : ""}
</section>${
    c.marquee.length
      ? `<div class="marquee" aria-hidden="true"><div class="mq-track">${[...c.marquee, ...c.marquee, ...c.marquee, ...c.marquee].map((m) => `<span>${esc(m)}</span><i>${icon(c.icon, "mi")}</i>`).join("")}</div></div>`
      : ""
  }`;
}

function contact(s: Of<"contact">, ctx: RenderCtx): string {
  const { c } = ctx;
  const b = c.business;
  const n = waNumber(b.whatsapp || b.phone);
  const tel = telHref(b.phone);
  const ig = b.instagram ? safeUrl(b.instagram.startsWith("http") ? b.instagram : `https://instagram.com/${b.instagram.replace(/^@/, "")}`) : "";
  const items = [
    b.address && `<li class="rv">${icon("pin", "ct-ic")}<div><p class="ct-k">Endereço</p><p>${esc(b.address)}</p></div></li>`,
    tel && `<li class="rv">${icon("phone", "ct-ic")}<div><p class="ct-k">Telefone</p><a href="${esc(tel)}">${esc(b.phone)}</a></div></li>`,
    n && `<li class="rv">${icon("chat", "ct-ic")}<div><p class="ct-k">WhatsApp</p><a href="https://wa.me/${n}" target="_blank" rel="noopener noreferrer">Enviar mensagem<span class="sr-only"> (abre em nova aba)</span></a></div></li>`,
    b.email && `<li class="rv">${icon("chat", "ct-ic")}<div><p class="ct-k">E-mail</p><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div></li>`,
    ig && ig !== "#" && `<li class="rv">${icon("heart", "ct-ic")}<div><p class="ct-k">Instagram</p><a href="${esc(ig)}" target="_blank" rel="noopener noreferrer">${esc(b.instagram)}</a></div></li>`,
  ].filter(Boolean);
  const dir = directionsUrl(c);
  const open = mapsUrl(c);
  const hasPlace = !!(b.address || (b.lat != null && b.lng != null));
  let map = "";
  if (s.showMap && hasPlace) {
    const q = b.address ? `${b.name}, ${b.address}` : `${b.lat},${b.lng}`;
    const frame = ctx.mapsEmbedKey && !ctx.preview
      ? `<iframe title="Mapa com a localização de ${esc(b.name)}" src="https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(ctx.mapsEmbedKey)}&amp;q=${encodeURIComponent(q)}&amp;language=pt-BR&amp;region=BR" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
      : ctx.preview
        ? `<div class="map-ph">${icon("pin", "mp-ic")}<p>O mapa interativo do Google aparece aqui no site publicado.</p></div>`
        : "";
    map = `<div class="map-card rv${frame ? "" : " solo"}">${frame ? `<div class="map-frame">${frame}</div>` : ""}<div class="map-actions">${dir ? `<a class="btn btn-main" href="${esc(dir)}" target="_blank" rel="noopener noreferrer">${icon("pin", "bi")}<span>Traçar rota</span><span class="sr-only"> (abre o Google Maps)</span></a>` : ""}${open ? `<a class="btn btn-ghost" href="${esc(open)}" target="_blank" rel="noopener noreferrer"><span>Abrir no Google Maps</span></a>` : ""}</div></div>`;
  }
  if (!items.length && !map) return "";
  return `<section id="${esc(s.id)}" class="sec contact-sec" aria-labelledby="${esc(s.id)}-t"><div class="wrap">${sectionHead(s.title, s.text, "Fale com a gente", s.id)}<div class="${map.includes("map-frame") ? "contact-grid" : ""}"><ul class="contact">${items.join("")}</ul>${map}</div></div></section>`;
}

function quote(s: Of<"quote">, ctx: RenderCtx): string {
  const { c } = ctx;
  const n = waNumber(c.business.whatsapp || c.business.phone);
  if (!n && !c.business.email) return "";
  const id = esc(s.id);
  return `<section id="${id}" class="sec alt" aria-labelledby="${id}-t"><div class="wrap split quote-split"><div>${sectionHead(s.title, s.text, "Orçamento", s.id)}<ul class="ticks rv"><li>${icon("check", "ti")}Resposta pelo ${n ? "WhatsApp" : "e-mail"}</li><li>${icon("check", "ti")}Sem compromisso</li><li>${icon("check", "ti")}Atendimento direto com a equipe</li></ul></div>
<form class="quote rv" novalidate data-wa="${esc(n ?? "")}" data-email="${esc(c.business.email)}" data-biz="${esc(c.business.name)}" aria-describedby="${id}-note">
  <div class="fld"><label for="${id}-nome">Seu nome <span aria-hidden="true">*</span></label><input id="${id}-nome" name="nome" required minlength="2" maxlength="80" autocomplete="name" aria-describedby="${id}-nome-err"><p class="err" id="${id}-nome-err" aria-live="polite"></p></div>
  <div class="fld"><label for="${id}-tel">WhatsApp para retorno <span class="opt">(opcional)</span></label><input id="${id}-tel" name="telefone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="(11) 91234-5678" aria-describedby="${id}-tel-err"><p class="err" id="${id}-tel-err" aria-live="polite"></p></div>
  <div class="fld"><label for="${id}-msg">O que você precisa? <span aria-hidden="true">*</span></label><textarea id="${id}-msg" name="mensagem" required minlength="10" maxlength="800" rows="4" aria-describedby="${id}-msg-err"></textarea><p class="err" id="${id}-msg-err" aria-live="polite"></p></div>
  <button class="btn btn-main btn-lg" type="submit">${icon("chat", "bi")}<span>${esc(s.buttonLabel)}</span></button>
  <div class="form-status" role="status" aria-live="polite"></div>
  <p class="fine" id="${id}-note">Campos com * são obrigatórios. Seus dados não ficam guardados neste site: a mensagem abre no ${n ? "WhatsApp" : "seu e-mail"} para você enviar.</p>
</form></div></section>`;
}

export function sectionHtml(s: Section, ctx: RenderCtx, next?: Section): string {
  const { c } = ctx;
  const id = esc(s.id);
  const labelled = `aria-labelledby="${id}-t"`;
  switch (s.type) {
    case "hero":
      return hero(s, ctx, next);
    case "highlights":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec hl"${s.title ? ` ${labelled}` : ' aria-label="Destaques"'}><div class="wrap">${s.title ? sectionHead(s.title, undefined, undefined, s.id) : ""}<ul class="hl-grid">${s.items
        .map((it, i) => `<li class="hl-card rv" style="--d:${i}"><div class="hl-ic" aria-hidden="true">${icon(it.icon)}</div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`)
        .join("")}</ul></div></section>`;
    case "about": {
      const visual = s.image?.url
        ? `<div class="about-visual">${picture(s.image, "about-img rv", { width: 900, ratio: [4, 5], rv: "zoom", sizes: "(max-width: 860px) 100vw, 45vw" })}<span class="about-badge rv" data-rv="up" aria-hidden="true">${icon(c.icon)}</span></div>`
        : `<div class="about-art rv" aria-hidden="true"><div class="aa-ring"></div><div class="aa-mark">${icon(c.icon, "aa-ic")}</div><span class="aa-name">${esc(c.business.name)}</span></div>`;
      return `<section id="${id}" class="sec about" ${labelled}><div class="wrap split"><div class="about-text rv-group" data-rv="left">${sectionHead(s.title, undefined, "Nossa história", s.id)}<div class="rv prose" data-rv="left">${paras(s.text)}</div></div>${visual}</div></section>`;
    }
    case "services": {
      if (!s.items.length) return "";
      const priced = s.items.some((i) => i.price);
      if (c.style === "bold" || priced) {
        return `<section id="${id}" class="sec alt svc-list" ${labelled}><div class="wrap">${sectionHead(s.title, s.intro, "Serviços", s.id)}<ul class="price-list">${s.items
          .map(
            (it, i) =>
              `<li class="rv" style="--d:${i}"><span class="pl-ic" aria-hidden="true">${icon(it.icon ?? c.icon)}</span><div class="pl-main"><div class="pl-row"><h3>${esc(it.title)}</h3><span class="dots" aria-hidden="true"></span><span class="pl-price">${esc(it.price || "Consulte")}</span></div>${it.description ? `<p>${esc(it.description)}</p>` : ""}</div></li>`,
          )
          .join("")}</ul></div></section>`;
      }
      return `<section id="${id}" class="sec alt" ${labelled}><div class="wrap">${sectionHead(s.title, s.intro, "O que fazemos", s.id)}<ul class="cards">${s.items
        .map((it, i) =>
          it.image?.url
            ? `<li class="card has-img rv" style="--d:${i}">${picture(it.image, "card-img", { width: 640, sizes: "(max-width: 860px) 100vw, 33vw" })}<div class="card-body"><div class="card-ic sm" aria-hidden="true">${icon(it.icon ?? c.icon)}</div><h3>${esc(it.title)}</h3><p>${esc(it.description)}</p></div></li>`
            : `<li class="card rv" style="--d:${i}"><div class="card-ic" aria-hidden="true">${icon(it.icon ?? c.icon)}</div><h3>${esc(it.title)}</h3><p>${esc(it.description)}</p></li>`,
        )
        .join("")}</ul></div></section>`;
    }
    case "products":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec alt" ${labelled}><div class="wrap">${sectionHead(s.title, s.intro, "Destaques", s.id)}<ul class="cards prod">${s.items
        .map(
          (it, i) =>
            it.image?.url
              ? `<li class="card has-img rv" style="--d:${i}">${picture(it.image, "card-img", { width: 640, sizes: "(max-width: 860px) 100vw, 33vw" })}<div class="card-body"><h3>${esc(it.name)}</h3><p>${esc(it.description)}</p></div></li>`
              : `<li class="card rv" style="--d:${i}"><div class="prod-art" aria-hidden="true">${icon(c.icon)}</div><h3>${esc(it.name)}</h3><p>${esc(it.description)}</p></li>`,
        )
        .join("")}</ul></div></section>`;
    case "menu": {
      const cats = s.categories.filter((cat) => cat.items.length);
      if (!cats.length) return "";
      const anyPrice = cats.some((cat) => cat.items.some((i) => i.price));
      return `<section id="${id}" class="sec menu-sec" ${labelled}><div class="wrap">${sectionHead(s.title, s.intro, "Cardápio", s.id)}
<div class="tabs rv" role="tablist" aria-label="Categorias do cardápio">${cats.map((cat, i) => `<button type="button" role="tab" id="${id}-tab-${i}" class="tab${i === 0 ? " on" : ""}" data-tab="${i}" aria-selected="${i === 0}" aria-controls="${id}-panel-${i}" tabindex="${i === 0 ? 0 : -1}">${esc(cat.name)}</button>`).join("")}</div>
<div class="menu-panels">${cats
        .map(
          (cat, i) =>
            `<div class="menu-panel${i === 0 ? " on" : ""}" id="${id}-panel-${i}" data-panel="${i}" role="tabpanel" aria-labelledby="${id}-tab-${i}"><h3 class="mp-title">${esc(cat.name)}</h3><ul class="menu">${cat.items
              .map(
                (it, j) =>
                  `<li class="rv" style="--d:${j % 8}"><div class="m-row"><h4>${esc(it.name)}</h4><span class="dots" aria-hidden="true"></span>${it.price ? `<span class="m-price">${esc(it.price)}</span>` : ""}</div>${it.description ? `<p>${esc(it.description)}</p>` : ""}</li>`,
              )
              .join("")}</ul></div>`,
        )
        .join("")}</div>
<p class="fine">${anyPrice ? "Valores e disponibilidade sujeitos a alteração." : "Consulte valores e disponibilidade pelo WhatsApp."}</p></div></section>`;
    }
    case "steps":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec steps-sec" ${labelled}><div class="wrap">${sectionHead(s.title, s.intro, "Como funciona", s.id)}<ol class="steps">${s.items
        .map((it, i) => `<li class="rv" style="--d:${i}"><span class="st-n" aria-hidden="true">${i + 1}</span><div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></div></li>`)
        .join("")}</ol></div></section>`;
    case "hours": {
      const lines = s.lines.filter((l) => l.value.trim());
      if (!lines.length) return "";
      return `<section id="${id}" class="sec hours-sec" ${labelled}><div class="wrap narrow">${sectionHead(s.title, undefined, "Venha nos visitar", s.id)}<div class="hours-card rv">${icon("clock", "hc-ic")}<dl class="hours">${lines
        .map((l) => `<div data-day="${esc(l.label.toLowerCase())}"><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`)
        .join("")}</dl>${s.note ? `<p class="fine">${esc(s.note)}</p>` : ""}</div></div></section>`;
    }
    case "gallery": {
      const imgs = s.images.filter((im) => im.url && safeUrl(im.url) !== "#");
      if (!imgs.length) return "";
      const data = imgs.map((im) => ({ src: im.url, alt: im.alt, credit: creditText(im) }));
      return `<section id="${id}" class="sec gallery-sec" ${labelled}><div class="wrap">${sectionHead(s.title, imgs.length > 1 ? "Toque em uma foto para ampliar." : undefined, "Fotos", s.id)}<ul class="gallery${imgs.length >= 5 ? " mosaic" : ""}" data-lightbox='${esc(JSON.stringify(data))}'>${imgs
        .map(
          (im, k) =>
            `<li class="g-item rv" data-rv="zoom" style="--d:${k % 6}"><button type="button" class="g-btn" data-lb="${k}" aria-label="Ampliar foto ${k + 1} de ${imgs.length}${im.alt ? `: ${esc(im.alt)}` : ""}">${pictureTag(im, { width: k === 0 && imgs.length >= 5 ? 960 : 640, ratio: [1, 1], sizes: k === 0 && imgs.length >= 5 ? "(max-width: 860px) 100vw, 50vw" : "(max-width: 860px) 50vw, 25vw" })}<span class="g-zoom" aria-hidden="true">${icon("sparkles")}</span></button></li>`,
        )
        .join("")}</ul>${imgs.some((im) => im.credit?.source === "google") ? `<p class="fine">Fotos publicadas no Google Maps pelos autores indicados ao ampliar.</p>` : ""}</div></section>`;
    }
    case "faq":
      if (!s.items.length) return "";
      return `<section id="${id}" class="sec alt" ${labelled}><div class="wrap narrow">${sectionHead(s.title, undefined, "Dúvidas", s.id)}<div class="faq">${s.items
        .map((it, i) => `<details class="rv" style="--d:${i}"><summary>${esc(it.q)}<span class="fq-ic" aria-hidden="true"></span></summary><div class="fq-a">${paras(it.a)}</div></details>`)
        .join("")}</div></div></section>`;
    case "cta":
      return `<section id="${id}" class="cta" ${labelled}><div class="cta-bg" aria-hidden="true"><div class="shine"></div></div><div class="wrap narrow center rv"><h2 id="${id}-t">${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}${button(s.button, c, "light", "btn-lg")}</div></section>`;
    case "quote":
      return quote(s, ctx);
    case "contact":
      return contact(s, ctx);
    case "text":
      return `<section id="${id}" class="sec" ${labelled}><div class="wrap narrow">${sectionHead(s.title, undefined, undefined, s.id)}<div class="rv prose">${paras(s.text)}</div></div></section>`;
  }
}

/** Barra fixa de ações no celular: as três ações que mais convertem. */
export function mobileBar(c: SiteContent): string {
  const tel = telHref(c.business.phone);
  const wa = whatsappUrl(c);
  const dir = directionsUrl(c);
  const items = [
    tel && `<a href="${esc(tel)}">${icon("phone", "mb-ic")}<span>Ligar</span></a>`,
    wa && `<a class="mb-main" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icon("chat", "mb-ic")}<span>WhatsApp</span></a>`,
    dir && `<a href="${esc(dir)}" target="_blank" rel="noopener noreferrer">${icon("pin", "mb-ic")}<span>Rota</span></a>`,
  ].filter(Boolean);
  if (items.length < 2) return "";
  return `<nav class="mbar" aria-label="Ações rápidas">${items.join("")}</nav>`;
}

