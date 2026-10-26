// Widget registry. Every src/widgets/<id>.ts (except this file) is a widget; lessons refer to it by <id>.
// Widgets are code-split: a widget's module (and the shared models it imports) loads only when a lesson needs it.
import type { WidgetMount } from "../types";

const modules = import.meta.glob<{ mount: WidgetMount }>(["./*.ts", "!./index.ts"]);

export const WIDGET_IDS = Object.keys(modules).map((p) => p.slice(2, -3));

export async function loadWidget(id: string): Promise<WidgetMount> {
  const load = modules[`./${id}.ts`];
  if (!load) throw new Error(`widget "${id}" not found (have: ${WIDGET_IDS.join(", ")})`);
  const mod = await load();
  if (typeof mod.mount !== "function") throw new Error(`widget "${id}" does not export mount(el, ctx)`);
  return mod.mount;
}
