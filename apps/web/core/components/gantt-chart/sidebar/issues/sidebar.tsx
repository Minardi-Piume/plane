/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RefObject } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { ChevronRight } from "lucide-react";
// ui
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import type { IBlockUpdateData } from "@plane/types";
import { Loader, Row } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { BLOCK_HEIGHT } from "@/components/gantt-chart/constants";
// Minardi fork: corsie raggruppate
import { isGroupHeaderId, useGanttGroups } from "@/components/gantt-chart/contexts/group-context";
import { GanttLayoutListItemLoader } from "@/components/ui/loader/layouts/gantt-layout-loader";
//hooks
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// local imports
import { useTimeLineChart } from "../../../../hooks/use-timeline-chart";
import { GanttDnDHOC } from "../gantt-dnd-HOC";
import { handleOrderChange } from "../utils";
import { IssuesSidebarBlock } from "./block";

type Props = {
  blockUpdateHandler: (block: any, payload: IBlockUpdateData) => void;
  canLoadMoreBlocks?: boolean;
  loadMoreBlocks?: () => void;
  ganttContainerRef: RefObject<HTMLDivElement>;
  blockIds: string[];
  enableReorder: boolean;
  enableSelection: boolean;
  showAllBlocks?: boolean;
  selectionHelpers?: TSelectionHelper;
  isEpic?: boolean;
};

export const IssueGanttSidebar = observer(function IssueGanttSidebar(props: Props) {
  const {
    blockUpdateHandler,
    blockIds,
    enableReorder,
    enableSelection,
    loadMoreBlocks,
    canLoadMoreBlocks,
    ganttContainerRef,
    showAllBlocks = false,
    selectionHelpers,
    isEpic = false,
  } = props;

  const { getBlockById } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  // Minardi fork: corsie (packed = stile Asana; sennò intestazioni legacy)
  const { packed, sections, headers: groupHeaders, toggleGroup } = useGanttGroups();

  const {
    issues: { getIssueLoader },
  } = useIssuesStore();

  const [intersectionElement, setIntersectionElement] = useState<HTMLDivElement | null>(null);

  const isPaginating = !!getIssueLoader();

  useIntersectionObserver(
    ganttContainerRef,
    isPaginating ? null : intersectionElement,
    loadMoreBlocks,
    "100% 0% 100% 0%"
  );

  const handleOnDrop = (
    draggingBlockId: string | undefined,
    droppedBlockId: string | undefined,
    dropAtEndOfList: boolean
  ) => {
    handleOrderChange(draggingBlockId, droppedBlockId, dropAtEndOfList, blockIds, getBlockById, blockUpdateHandler);
  };

  // Minardi fork: sidebar "a corsie impacchettate" — solo intestazioni-sezione,
  // altezza = banda (rowCount * BLOCK_HEIGHT), header in alto. Allineata alle bande del grafico.
  if (packed) {
    return (
      <div>
        {sections.map((section) => (
          <div key={section.id} style={{ height: `${(section.isCollapsed ? 1 : section.rowCount) * BLOCK_HEIGHT}px` }}>
            <Row
              className="group sticky left-0 z-[5] flex w-full cursor-pointer items-center gap-1.5 bg-layer-1 pr-4 font-medium hover:bg-layer-1-hover"
              style={{ height: `${BLOCK_HEIGHT}px` }}
              onClick={() => toggleGroup(section.id)}
            >
              <ChevronRight
                className={cn("size-4 flex-shrink-0 text-secondary transition-transform", {
                  "rotate-90": !section.isCollapsed,
                })}
              />
              <span className="truncate text-13">{section.name}</span>
              <span className="flex-shrink-0 text-11 text-secondary">{section.count}</span>
            </Row>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {blockIds ? (
        <>
          {blockIds.map((blockId, index) => {
            // Minardi fork: riga-intestazione di sezione (corsia). PRIMA di getBlockById.
            if (isGroupHeaderId(blockId)) {
              const header = groupHeaders[blockId];
              if (!header) return null;
              return (
                <Row
                  key={blockId}
                  className="group sticky left-0 z-[5] flex w-full cursor-pointer items-center gap-1.5 bg-layer-1 pr-4 font-medium hover:bg-layer-1-hover"
                  style={{ height: `${BLOCK_HEIGHT}px` }}
                  onClick={() => toggleGroup(header.group.id)}
                >
                  <ChevronRight
                    className={cn("size-4 flex-shrink-0 text-secondary transition-transform", {
                      "rotate-90": !header.isCollapsed,
                    })}
                  />
                  <span className="truncate text-13">{header.group.name}</span>
                  <span className="flex-shrink-0 text-11 text-secondary">{header.count}</span>
                </Row>
              );
            }
            const block = getBlockById(blockId);
            const isBlockVisibleOnSidebar = block?.start_date && block?.target_date;

            // hide the block if it doesn't have start and target dates and showAllBlocks is false
            if (!block || (!showAllBlocks && !isBlockVisibleOnSidebar)) return;

            return (
              <RenderIfVisible
                key={block.id}
                root={ganttContainerRef}
                horizontalOffset={100}
                verticalOffset={200}
                shouldRecordHeights={false}
                placeholderChildren={<GanttLayoutListItemLoader />}
              >
                <GanttDnDHOC
                  id={block.id}
                  isLastChild={index === blockIds.length - 1}
                  isDragEnabled={enableReorder}
                  onDrop={handleOnDrop}
                >
                  {(isDragging: boolean) => (
                    <IssuesSidebarBlock
                      block={block}
                      enableSelection={enableSelection}
                      isDragging={isDragging}
                      selectionHelpers={selectionHelpers}
                      isEpic={isEpic}
                    />
                  )}
                </GanttDnDHOC>
              </RenderIfVisible>
            );
          })}
          {canLoadMoreBlocks && (
            <div ref={setIntersectionElement} className="p-2">
              <div className="flex h-10 w-full animate-pulse items-center justify-between gap-1.5 rounded-sm bg-layer-1 px-4 py-1.5 md:h-8 md:px-1" />
            </div>
          )}
        </>
      ) : (
        <Loader className="space-y-3 pr-2">
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
          <Loader.Item height="34px" />
        </Loader>
      )}
    </div>
  );
});
