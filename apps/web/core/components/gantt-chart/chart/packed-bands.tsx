/**
 * Minardi fork: rendering "a corsie impacchettate" (stile Asana) del grafico Gantt.
 * Per ogni sezione una banda; i task sono barre posizionate in assoluto:
 * left = posizione data (dal chart store), top = sotto-riga (dal packing), width = durata.
 * Le barre sono PackedGanttBar (trascinabili: move + resize) quando il drag è abilitato.
 * Sotto le barre un layer SVG disegna le frecce di dipendenza (blocked_by), stile Asana.
 */
import type { RefObject } from "react";
import { observer } from "mobx-react";
import type { IBlockUpdateDependencyData } from "@plane/types";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
import { BLOCK_HEIGHT } from "../constants";
import { useGanttGroups } from "../contexts/group-context";
import { getPositionFromDate } from "../views/helpers";
import { PackedGanttBar } from "./packed-bar";
import { PackedDependencyPaths } from "./packed-dependency-paths";
import {
  PACKED_HEADER_HEIGHT,
  PackedLabelWidthsContext,
  computePackedLabelWidths,
  usePackedLayout,
} from "./packed-layout";

type EnableFlag = boolean | ((blockId: string) => boolean);
const resolveFlag = (flag: EnableFlag, blockId: string): boolean => (typeof flag === "function" ? flag(blockId) : flag);

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockToRender: (data: any) => React.ReactNode;
  itemsContainerWidth: number;
  ganttContainerRef: RefObject<HTMLDivElement>;
  updateBlockDates?: (updates: IBlockUpdateDependencyData[]) => Promise<void>;
  enableBlockLeftResize: EnableFlag;
  enableBlockRightResize: EnableFlag;
  enableBlockMove: EnableFlag;
};

export const GanttPackedBands = observer(function GanttPackedBands(props: Props) {
  const {
    blockToRender,
    itemsContainerWidth,
    ganttContainerRef,
    updateBlockDates,
    enableBlockLeftResize,
    enableBlockRightResize,
    enableBlockMove,
  } = props;
  const { sections } = useGanttGroups();
  const { getBlockById, currentViewData } = useTimeLineChartStore();
  // Minardi fork: layout per-finestra (rowCount/subRow sulle sole barre in vista)
  const packedLayout = usePackedLayout();

  // top cumulativo di ogni banda (serve al layer frecce per le coordinate verticali)
  const bandTops: Record<string, number> = {};
  let totalHeight = 0;
  for (const section of sections) {
    bandTops[section.id] = totalHeight;
    totalHeight += PACKED_HEADER_HEIGHT + (section.isCollapsed ? 0 : section.rowCount * BLOCK_HEIGHT);
  }

  // spazio libero a destra di ogni barra sulla sua sotto-riga: le etichette esterne si
  // troncano lì, così non si sovrappongono mai alle barre successive (stile Asana)
  const labelWidths = computePackedLabelWidths(sections, getBlockById);

  // Minardi fork: marcatore verticale "OGGI" (stile Asana/mockup), coordinate chart-local
  // (x = giorni da inizio chart × dayWidth), distinto per colore dalle linee di dipendenza.
  const todayX = currentViewData ? getPositionFromDate(currentViewData, new Date(), 0) : null;

  return (
    <PackedLabelWidthsContext.Provider value={labelWidths}>
      <div className="absolute top-0 left-0 w-max min-w-full">
        <PackedDependencyPaths
          sections={sections}
          bandTops={bandTops}
          totalHeight={totalHeight}
          itemsContainerWidth={itemsContainerWidth}
        />
        {todayX != null && todayX > 0 && (
          <div
            className="pointer-events-none absolute top-0 z-[6]"
            style={{ left: `${todayX}px`, height: `${totalHeight}px` }}
          >
            <div className="h-full w-0.5 -translate-x-1/2 bg-accent-primary opacity-70" />
            <div className="tracking-wider absolute top-0 left-0 -translate-x-1/2 rounded-b-[4px] bg-accent-primary px-1.5 py-0.5 text-[9px] font-bold text-on-color">
              OGGI
            </div>
          </div>
        )}
        {sections.map((section) => {
          const rows = packedLayout[section.id];
          // Altezza banda e sotto-righe dal packing GLOBALE (stile Asana): la banda è alta
          // quanto serve per TUTTI i task della sezione e resta fissa scorrendo — così una
          // sezione espansa non appare mai vuota anche se i suoi task non sono vicini a "oggi".
          const rowCount = section.rowCount;
          const subRowOf = section.subRowByBlockId;
          // virtualizzazione: renderizza solo le barre nella finestra visibile (visibleIds),
          // posizionandole alla loro sotto-riga globale; le altre compaiono scorrendo.
          const idsToRender = rows?.visibleIds ?? section.blockIds;
          const bandHeight = PACKED_HEADER_HEIGHT + (section.isCollapsed ? 0 : rowCount * BLOCK_HEIGHT);
          return (
            <div
              key={section.id}
              className="relative border-b-[0.5px] border-subtle"
              style={{
                width: `${itemsContainerWidth}px`,
                height: `${bandHeight}px`,
              }}
            >
              {/* riga-intestazione (stile Asana): lato grafico vuota, sfondo sottile */}
              <div
                className="absolute top-0 left-0 w-full bg-layer-1"
                style={{ height: `${PACKED_HEADER_HEIGHT}px` }}
              />
              {!section.isCollapsed &&
                idsToRender.map((blockId) => (
                  <PackedGanttBar
                    key={blockId}
                    blockId={blockId}
                    subRow={subRowOf[blockId] ?? 0}
                    blockToRender={blockToRender}
                    ganttContainerRef={ganttContainerRef}
                    updateBlockDates={updateBlockDates}
                    enableBlockLeftResize={resolveFlag(enableBlockLeftResize, blockId)}
                    enableBlockRightResize={resolveFlag(enableBlockRightResize, blockId)}
                    enableBlockMove={resolveFlag(enableBlockMove, blockId)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </PackedLabelWidthsContext.Provider>
  );
});
