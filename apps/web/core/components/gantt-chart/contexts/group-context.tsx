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

export type TGanttGroupContext = {
  enabled: boolean;
  headers: Record<string, TGanttGroupHeader>; // chiave = id sentinella
  toggleGroup: (groupId: string) => void;
};

export const GanttGroupContext = createContext<TGanttGroupContext>({
  enabled: false,
  headers: {},
  toggleGroup: () => {},
});

export const useGanttGroups = (): TGanttGroupContext => useContext(GanttGroupContext);
