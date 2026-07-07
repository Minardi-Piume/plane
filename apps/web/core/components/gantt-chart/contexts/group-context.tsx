/**
 * Minardi fork: contesto per la Timeline raggruppata a corsie (per sezione/stato/label).
 * Le "sentinelle" sono id speciali iniettati in blockIds a inizio di ogni gruppo:
 * le liste (sidebar, RowList, BlocksList) consumano lo stesso array, quindi restano
 * allineate; ognuna riconosce la sentinella e renderizza una riga-intestazione.
 */
import { createContext, useContext } from "react";
import type { IBaseLayoutsBaseGroup } from "@plane/types";

export const GANTT_GROUP_HEADER_PREFIX = "__gantt_group_header__::";

export const makeGroupHeaderId = (groupId: string): string => `${GANTT_GROUP_HEADER_PREFIX}${groupId}`;
export const isGroupHeaderId = (id: string): boolean => id.startsWith(GANTT_GROUP_HEADER_PREFIX);
export const groupIdFromHeaderId = (id: string): string => id.slice(GANTT_GROUP_HEADER_PREFIX.length);

export type TGanttGroupHeader = {
  group: IBaseLayoutsBaseGroup;
  count: number;
  isCollapsed: boolean;
};

// Minardi fork: modello "corsie impacchettate" (Asana). Ogni sezione è una banda;
// i task sono impacchettati su sotto-righe (subRow) per data (interval partitioning).
export type TPackedSection = {
  id: string;
  name: string;
  count: number;
  isCollapsed: boolean;
  rowCount: number; // n. sotto-righe (min 1) → altezza banda = rowCount * BLOCK_HEIGHT
  blockIds: string[]; // task della sezione con date valide, in ordine
  subRowByBlockId: Record<string, number>; // blockId -> indice sotto-riga (0-based)
  noDateCount: number; // task della sezione senza date (non mostrati come barre)
};

export type TGanttGroupContext = {
  enabled: boolean;
  packed: boolean; // true = rendering a corsie impacchettate (stile Asana)
  sections: TPackedSection[];
  headers: Record<string, TGanttGroupHeader>; // legacy (percorso sentinella, non usato in packed)
  toggleGroup: (groupId: string) => void;
};

export const GanttGroupContext = createContext<TGanttGroupContext>({
  enabled: false,
  packed: false,
  sections: [],
  headers: {},
  toggleGroup: () => {},
});

export const useGanttGroups = (): TGanttGroupContext => useContext(GanttGroupContext);
