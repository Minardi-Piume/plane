/**
 * Minardi fork: rendering "a corsie impacchettate" (stile Asana) del grafico Gantt.
 * Per ogni sezione una banda; i task sono barre posizionate in assoluto:
 * left = posizione data (dal chart store), top = sotto-riga (dal packing), width = durata.
 * SPIKE drag: le barre sono PackedGanttBar (trascinabili) se il drag è abilitato.
 */
import type { RefObject } from "react";
import { observer } from "mobx-react";
import type { IBlockUpdateDependencyData } from "@plane/types";
import { BLOCK_HEIGHT } from "../constants";
import { useGanttGroups } from "../contexts/group-context";
import { PackedGanttBar } from "./packed-bar";
import { usePackedLayout } from "./packed-layout";

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
  // Minardi fork: layout per-finestra (rowCount/subRow sulle sole barre in vista)
  const packedLayout = usePackedLayout();

  return (
    <div className="absolute top-0 left-0 w-max min-w-full">
      {sections.map((section) => {
        const rows = packedLayout[section.id];
        const rowCount = rows?.rowCount ?? section.rowCount;
        const subRowOf = rows?.subRowByBlockId ?? section.subRowByBlockId;
        // virtualizzazione: renderizza solo le barre in vista (visibleIds), non tutti i blockIds
        const idsToRender = rows?.visibleIds ?? section.blockIds;
        return (
          <div
            key={section.id}
            className="relative border-b-[0.5px] border-subtle"
            style={{
              width: `${itemsContainerWidth}px`,
              height: `${(section.isCollapsed ? 1 : rowCount) * BLOCK_HEIGHT}px`,
            }}
          >
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
  );
});
