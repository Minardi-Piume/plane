/**
 * Minardi fork: rendering "a corsie impacchettate" (stile Asana) del grafico Gantt.
 * Per ogni sezione una banda; i task sono barre posizionate in assoluto:
 * left = posizione data (dal chart store), top = sotto-riga (dal packing), width = durata.
 */
import { observer } from "mobx-react";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
import { BLOCK_HEIGHT } from "../constants";
import { useGanttGroups } from "../contexts/group-context";
import { usePackedLayout } from "./packed-layout";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockToRender: (data: any) => React.ReactNode;
  itemsContainerWidth: number;
};

export const GanttPackedBands = observer(function GanttPackedBands(props: Props) {
  const { blockToRender, itemsContainerWidth } = props;
  const { sections } = useGanttGroups();
  const { getBlockById } = useTimeLineChartStore();
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
              idsToRender.map((blockId) => {
                const block = getBlockById(blockId);
                if (!block?.position) return null;
                const subRow = subRowOf[blockId] ?? 0;
                return (
                  <div
                    key={blockId}
                    className="absolute"
                    style={{
                      top: `${subRow * BLOCK_HEIGHT}px`,
                      left: `${block.position.marginLeft}px`,
                      width: `${block.position.width}px`,
                      height: `${BLOCK_HEIGHT}px`,
                    }}
                  >
                    {blockToRender(block.data)}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
});
