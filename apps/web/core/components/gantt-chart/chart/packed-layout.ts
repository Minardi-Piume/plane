/**
 * Minardi fork: packing "per finestra visibile" delle corsie impacchettate.
 *
 * Il packing globale (in base-gantt-root) dimensiona ogni banda sulla concorrenza
 * massima su TUTTO l'arco temporale (2019→2026) → bande altissime e quasi vuote in
 * una singola finestra. Qui ricalcoliamo rowCount/subRow considerando SOLO le barre
 * che intersecano la finestra attualmente renderizzata (`[0, itemsContainerWidth]`),
 * usando le posizioni in pixel già calcolate dal chart store (reattive a zoom/scroll).
 * Risultato: bande compatte, che crescono solo quando si scorre e si caricano più date.
 */
import { createContext, useContext } from "react";
import type { IGanttBlock } from "@plane/types";

export type TPackedRow = {
  rowCount: number; // n. sotto-righe necessarie nella finestra visibile (min 1)
  subRowByBlockId: Record<string, number>; // blockId -> indice sotto-riga (solo barre in finestra)
  visibleIds: string[]; // id delle sole barre in finestra, ordinati per posizione (per il rendering)
};

export type TPackedLayout = Record<string, TPackedRow>; // sectionId -> layout

// gap minimo (px) tra due barre sulla stessa sotto-riga, per non farle "toccare"
const MIN_GAP_PX = 4;

// altezza (px) della riga-intestazione di sezione (stile Asana: header su riga propria,
// leggermente più bassa delle righe-barra). Usata IDENTICA da sidebar e grafico per l'allineamento.
export const PACKED_HEADER_HEIGHT = 34;

/**
 * Impacchetta le barre di ogni sezione sulle sotto-righe (interval partitioning sui
 * pixel), includendo solo quelle che intersecano la finestra `[windowStart, windowEnd]`
 * (in pixel, coordinate chart-local). Passando la porzione VISIBILE si ottengono bande
 * strette come il viewport; passando `[0, itemsContainerWidth]` l'intera finestra renderizzata.
 */
export const computePackedLayout = (
  sections: { id: string; blockIds: string[] }[],
  getBlockById: (blockId: string) => IGanttBlock | undefined,
  windowStart: number,
  windowEnd: number
): TPackedLayout => {
  const layout: TPackedLayout = {};
  for (const section of sections) {
    const spans: { id: string; left: number; right: number }[] = [];
    for (const id of section.blockIds) {
      const pos = getBlockById(id)?.position;
      if (!pos) continue;
      const left = pos.marginLeft;
      const right = pos.marginLeft + pos.width;
      // scarta le barre completamente fuori dalla finestra considerata
      if (right < windowStart || left > windowEnd) continue;
      spans.push({ id, left, right });
    }
    spans.sort((a, b) => a.left - b.left);
    const rowEnds: number[] = []; // right più a destra occupato per ogni sotto-riga
    const subRowByBlockId: Record<string, number> = {};
    for (const s of spans) {
      let placed = rowEnds.findIndex((end) => end <= s.left - MIN_GAP_PX);
      if (placed === -1) {
        placed = rowEnds.length;
        rowEnds.push(s.right);
      } else {
        rowEnds[placed] = s.right;
      }
      subRowByBlockId[s.id] = placed;
    }
    layout[section.id] = {
      // 0 sotto-righe se nessuna barra è in finestra → banda = sola intestazione (stile Asana)
      rowCount: rowEnds.length,
      subRowByBlockId,
      visibleIds: spans.map((s) => s.id),
    };
  }
  return layout;
};

// riferimento stabile per la modalità non-packed (evita nuovi oggetti a ogni render)
export const EMPTY_PACKED_LAYOUT: TPackedLayout = {};

export const PackedLayoutContext = createContext<TPackedLayout>(EMPTY_PACKED_LAYOUT);

export const usePackedLayout = (): TPackedLayout => useContext(PackedLayoutContext);

// ─── Etichette stile Asana ───────────────────────────────────────────────────
// Barra "larga" → nome DENTRO (troncato alla barra); barra stretta → nome FUORI a
// destra, troncato allo spazio libero prima della barra successiva sulla stessa
// sotto-riga (così i nomi non si sovrappongono mai alle barre vicine).

// sotto questa larghezza (px) della barra il nome va fuori, accanto alla barra
export const PACKED_LABEL_INSIDE_MIN_WIDTH = 80;
// tetto (px) per l'etichetta esterna (come il maxWidth storico)
export const PACKED_LABEL_MAX_WIDTH = 280;
// sotto questo spazio disponibile (px) l'etichetta esterna non viene resa affatto
export const PACKED_LABEL_MIN_WIDTH = 20;

// blockId -> px liberi a destra della barra (fino alla barra successiva della sotto-riga)
export type TPackedLabelWidths = Record<string, number>;

type TPackedSectionLike = {
  id: string;
  blockIds: string[];
  subRowByBlockId: Record<string, number>;
  isCollapsed: boolean;
};

/**
 * Spazio libero a destra di ogni barra sulla sua sotto-riga (packing GLOBALE, lo stesso
 * usato per posizionare le barre). Serve a troncare le etichette esterne stile Asana.
 */
export const computePackedLabelWidths = (
  sections: TPackedSectionLike[],
  getBlockById: (blockId: string) => IGanttBlock | undefined
): TPackedLabelWidths => {
  const out: TPackedLabelWidths = {};
  for (const section of sections) {
    if (section.isCollapsed) continue;
    const byRow = new Map<number, { id: string; left: number; right: number }[]>();
    for (const id of section.blockIds) {
      const pos = getBlockById(id)?.position;
      if (!pos) continue;
      const row = section.subRowByBlockId[id] ?? 0;
      const spans = byRow.get(row) ?? [];
      spans.push({ id, left: pos.marginLeft, right: pos.marginLeft + pos.width });
      byRow.set(row, spans);
    }
    for (const spans of byRow.values()) {
      spans.sort((a, b) => a.left - b.left);
      for (let i = 0; i < spans.length; i++) {
        const next = spans[i + 1];
        out[spans[i].id] = next ? Math.max(0, next.left - spans[i].right) : Number.POSITIVE_INFINITY;
      }
    }
  }
  return out;
};

export const PackedLabelWidthsContext = createContext<TPackedLabelWidths | null>(null);

export const usePackedLabelWidths = (): TPackedLabelWidths | null => useContext(PackedLabelWidthsContext);
