/**
 * Minardi fork: barra trascinabile per la timeline a corsie impacchettate.
 *
 * Rispecchia GanttChartBlock (blocks/block.tsx) ma è posizionata in ASSOLUTO dentro la
 * banda: top = sotto-riga (dal packing), marginLeft/width = posizione data (dal chart
 * store). Riusa useGanttResizable + ChartDraggable → il drag orizzontale sposta/ridimensiona
 * le date e salva via updateBlockDates, esattamente come nella Gantt standard di Plane.
 *
 * Durante il drag il packing è congelato a monte (isDragging in main-content) → la barra
 * resta nella sua corsia e l'altezza banda non cambia; il feedback visivo avviene per
 * mutazione diretta dello stile (marginLeft/width) fatta da useGanttResizable. Al rilascio
 * il packing si ricalcola sulle nuove date (la barra può cambiare sotto-riga, corretto).
 */
import type { RefObject } from "react";
import { useRef } from "react";
import { observer } from "mobx-react";
import type { IBlockUpdateDependencyData } from "@plane/types";
import { cn } from "@plane/utils";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
import { BLOCK_HEIGHT } from "../constants";
import { ChartDraggable } from "../helpers";
import { useGanttResizable } from "../helpers/blockResizables/use-gantt-resizable";

type Props = {
  blockId: string;
  subRow: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockToRender: (data: any) => React.ReactNode;
  enableBlockLeftResize: boolean;
  enableBlockRightResize: boolean;
  enableBlockMove: boolean;
  ganttContainerRef: RefObject<HTMLDivElement>;
  updateBlockDates?: (updates: IBlockUpdateDependencyData[]) => Promise<void>;
};

export const PackedGanttBar = observer(function PackedGanttBar(props: Props) {
  const {
    blockId,
    subRow,
    blockToRender,
    enableBlockLeftResize,
    enableBlockRightResize,
    enableBlockMove,
    ganttContainerRef,
    updateBlockDates,
  } = props;

  const { updateActiveBlockId, getBlockById } = useTimeLineChartStore();
  const resizableRef = useRef<HTMLDivElement>(null);

  const block = getBlockById(blockId);
  const { isMoving, handleBlockDrag } = useGanttResizable(block, resizableRef, ganttContainerRef, updateBlockDates);

  if (!block?.position || !block.data) return null;

  const isBlockComplete = !!block.start_date && !!block.target_date;

  return (
    <div
      className={cn("absolute z-[5]")}
      id={`gantt-packed-block-${block.id}`}
      ref={resizableRef}
      style={{
        top: `${subRow * BLOCK_HEIGHT}px`,
        left: 0,
        height: `${BLOCK_HEIGHT}px`,
        marginLeft: `${block.position.marginLeft}px`,
        width: `${block.position.width}px`,
      }}
    >
      <div
        className="relative flex h-full w-full items-center"
        onMouseEnter={() => updateActiveBlockId(blockId)}
        onMouseLeave={() => updateActiveBlockId(null)}
      >
        <ChartDraggable
          block={block}
          blockToRender={blockToRender}
          handleBlockDrag={handleBlockDrag}
          enableBlockLeftResize={enableBlockLeftResize}
          enableBlockRightResize={enableBlockRightResize}
          enableBlockMove={enableBlockMove && isBlockComplete}
          enableDependency={false}
          isMoving={isMoving}
          ganttContainerRef={ganttContainerRef}
        />
      </div>
    </div>
  );
});
