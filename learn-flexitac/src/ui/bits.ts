// Small shared renderers: badges, source chips, spec rows.
import { chips } from "../content/sources";
import { t } from "../i18n/strings";
import type { Badge, Spec } from "../types";
import { esc } from "./dom";

/** What a badge means (its tooltip; the about page's legend), in the site's language. */
export const badgeTitle = (b: Badge): string => t(`badge.${b}.title`);

/** A badge: its word in the site's language ("illustrative" / 「示意」), its meaning as the tooltip. */
export function badge(b: Badge | undefined): string {
  return b ? `<span class="badge badge-${b}" title="${esc(badgeTitle(b))}">${t(`badge.${b}`)}</span>` : "";
}

export function sourceChips(src: string): string {
  return chips(src)
    .map((c) =>
      c.href
        ? `<a class="chip" href="${esc(c.href)}" target="_blank" rel="noopener noreferrer" title="${esc(c.title)}">${esc(c.label)}</a>`
        : `<span class="chip" title="${esc(c.title)}" tabindex="0">${esc(c.label)}</span>`,
    )
    .join("");
}

export function specRows(specs: Spec[]): string {
  return `<dl class="spec-list">${specs
    .map(
      (s) => `<div class="spec-row">
        <dt>${esc(s.label)}</dt>
        <dd>
          <span class="spec-value">${s.value}</span>${badge(s.badge)}
          ${s.note ? `<span class="spec-note">${esc(s.note)}</span>` : ""}
          <span class="chips" aria-label="${t("sources.aria")}">${sourceChips(s.src)}</span>
        </dd>
      </div>`,
    )
    .join("")}</dl>`;
}
