/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Popover } from "@plane/propel/popover";
import { Tooltip } from "@plane/propel/tooltip";
import { ControlLink } from "@plane/ui";
import { findTotalDaysInRange, generateWorkItemLink, getDate } from "@plane/utils";
// components
import {
  PACKED_LABEL_INSIDE_MIN_WIDTH,
  PACKED_LABEL_MAX_WIDTH,
  PACKED_LABEL_MIN_WIDTH,
  usePackedLabelWidths,
} from "@/components/gantt-chart/chart/packed-layout";
import { SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
// plane web imports
import { IssueIdentifier } from "@/plane-web/components/issues/issue-details/issue-identifier";
import { IssueStats } from "@/plane-web/components/issues/issue-layouts/issue-stats";
// local imports
import { WorkItemPreviewCard } from "../../preview-card";
import { getBlockViewDetails } from "../utils";
import type { GanttStoreType } from "./base-gantt-root";

type Props = {
  issueId: string;
  isEpic?: boolean;
  // Minardi fork: in modalità corsie l'etichetta segue lo stile Asana — nome DENTRO la
  // barra se è abbastanza larga, altrimenti ACCANTO (fuori), troncato allo spazio libero
  // prima della barra successiva, con la data ("Scade 16 Apr" / "5 – 6 Mar") sotto.
  labelOutside?: boolean;
};

// data compatta stile Asana, in italiano ("16 Apr", "5 – 6 Mar", "26 Apr – 3 Mag")
const MESI_BREVI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const shortDate = (d: Date) => `${d.getDate()} ${MESI_BREVI[d.getMonth()]}`;
const shortDateYear = (d: Date) =>
  `${d.getDate()} ${MESI_BREVI[d.getMonth()]} ${String(d.getFullYear() % 100).padStart(2, "0")}`;
const packedDateLabel = (start: string | null | undefined, target: string | null | undefined): string | null => {
  const s = getDate(start);
  const t = getDate(target);
  if (s && t) {
    // stesso giorno (start === target): una sola data, non un finto intervallo "16 – 16 Apr"
    if (s.getTime() === t.getTime()) return shortDate(t);
    // anni diversi: mostra l'anno su entrambe, così non si perde una durata di mesi/anni
    if (s.getFullYear() !== t.getFullYear()) return `${shortDateYear(s)} – ${shortDateYear(t)}`;
    // stesso anno: il mese si ripete solo se cambia ("5 – 6 Mar", "26 Apr – 3 Mag")
    const left = s.getMonth() === t.getMonth() ? String(s.getDate()) : shortDate(s);
    return `${left} – ${shortDate(t)}`;
  }
  if (t) return `Scade ${shortDate(t)}`;
  if (s) return `Inizia ${shortDate(s)}`;
  return null;
};

export const IssueGanttBlock = observer(function IssueGanttBlock(props: Props) {
  const { issueId, isEpic, labelOutside = false } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const { getProjectStates } = useProjectState();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // hooks
  const { isMobile } = usePlatformOS();
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  // derived values
  const issueDetails = getIssueById(issueId);
  const stateDetails =
    issueDetails && getProjectStates(issueDetails?.project_id)?.find((state) => state?.id == issueDetails?.state_id);

  const { blockStyle } = getBlockViewDetails(issueDetails, stateDetails?.color ?? "");

  const handleIssuePeekOverview = () => handleRedirection(workspaceSlug, issueDetails, isMobile);

  const duration = findTotalDaysInRange(issueDetails?.start_date, issueDetails?.target_date) || 0;

  // Minardi fork (corsie stile Asana): barra larga → nome dentro; barra stretta → nome
  // fuori a destra, troncato allo spazio libero della sotto-riga (mai sopra altre barre),
  // con la data in piccolo sotto il nome. Reattivo a zoom perché position è observable.
  const { getBlockById } = useTimeLineChartStore();
  const packedLabelWidths = usePackedLabelWidths();
  const barWidth = labelOutside ? (getBlockById(issueId)?.position?.width ?? 0) : 0;
  const freeSpace = packedLabelWidths?.[issueId] ?? PACKED_LABEL_MAX_WIDTH;
  const outsideMaxWidth = Math.min(PACKED_LABEL_MAX_WIDTH, freeSpace - 6);
  // Nome FUORI (a destra + data) solo se la barra è stretta E c'è spazio libero sulla
  // sotto-riga; altrimenti DENTRO (barra larga, oppure stretta ma senza spazio a destra):
  // così nessuna barra resta anonima, come nel mockup (le barre corte mostrano il nome dentro).
  const nameOutside =
    labelOutside && barWidth < PACKED_LABEL_INSIDE_MIN_WIDTH && outsideMaxWidth >= PACKED_LABEL_MIN_WIDTH;
  const nameInside = labelOutside && !nameOutside;
  const dateLabel = nameOutside ? packedDateLabel(issueDetails?.start_date, issueDetails?.target_date) : null;

  return (
    <Popover delay={100} openOnHover>
      <Popover.Button
        className="w-full"
        render={
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            id={`issue-${issueId}`}
            className="space-between relative flex h-full w-full cursor-pointer items-center rounded-sm"
            style={blockStyle}
            onClick={handleIssuePeekOverview}
          >
            <div className="absolute top-0 left-0 h-full w-full bg-surface-1/50" />
            {nameOutside ? (
              // Minardi fork (corsie stile Asana): nome ACCANTO alla barra, troncato allo
              // spazio libero prima della barra successiva, con la data in piccolo sotto
              <div className="pointer-events-none absolute top-0 left-full flex h-full flex-col justify-center pl-1.5 whitespace-nowrap">
                <span className="truncate text-13 leading-4 text-primary" style={{ maxWidth: `${outsideMaxWidth}px` }}>
                  {issueDetails?.name}
                </span>
                {dateLabel && (
                  <span
                    className="truncate text-11 leading-[14px] text-placeholder"
                    style={{ maxWidth: `${outsideMaxWidth}px` }}
                  >
                    {dateLabel}
                  </span>
                )}
              </div>
            ) : nameInside ? (
              // Minardi fork: nome DENTRO la barra (larga, oppure stretta senza spazio a
              // destra) — troncato al bordo della barra; mai una barra senza nome.
              <div className="pointer-events-none relative z-[1] min-w-0 flex-1 truncate px-2 text-13 text-primary">
                {issueDetails?.name}
              </div>
            ) : (
              <div
                className="sticky w-auto flex-1 truncate overflow-hidden px-2.5 py-1 text-13 text-primary"
                style={{ left: `${SIDEBAR_WIDTH}px` }}
              >
                {issueDetails?.name}
              </div>
            )}
            {isEpic && (
              <IssueStats
                issueId={issueId}
                className="sticky mx-2 w-auto flex-shrink-0 justify-end truncate overflow-hidden font-medium text-primary"
                showProgressText={duration >= 2}
              />
            )}
          </div>
        }
      />
      <Popover.Panel side="bottom" align="start">
        <>
          {issueDetails && issueDetails?.project_id && (
            <WorkItemPreviewCard
              projectId={issueDetails.project_id}
              stateDetails={{
                id: issueDetails.state_id ?? undefined,
              }}
              workItem={issueDetails}
            />
          )}
        </>
      </Popover.Panel>
    </Popover>
  );
});

// rendering issues on gantt sidebar
export const IssueGanttSidebarBlock = observer(function IssueGanttSidebarBlock(props: Props) {
  const { issueId, isEpic = false } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { isMobile } = usePlatformOS();
  const storeType = useIssueStoreType() as GanttStoreType;
  const { issuesFilter } = useIssues(storeType);
  const { getProjectIdentifierById } = useProject();

  // handlers
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  // derived values
  const issueDetails = getIssueById(issueId);
  const projectIdentifier = getProjectIdentifierById(issueDetails?.project_id);

  const handleIssuePeekOverview = (e: any) => {
    e.stopPropagation(true);
    e.preventDefault();
    handleRedirection(workspaceSlug, issueDetails, isMobile);
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issueDetails?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issueDetails?.sequence_id,
    isEpic,
  });

  return (
    <ControlLink
      id={`issue-${issueId}`}
      href={workItemLink}
      onClick={handleIssuePeekOverview}
      className="line-clamp-1 w-full cursor-pointer text-13 text-primary"
      disabled={!!issueDetails?.tempId}
    >
      <div className="relative flex h-full w-full cursor-pointer items-center gap-2">
        {issueDetails?.project_id && (
          <IssueIdentifier
            issueId={issueDetails.id}
            projectId={issueDetails.project_id}
            size="xs"
            variant="tertiary"
            displayProperties={issuesFilter?.issueFilters?.displayProperties}
          />
        )}
        <Tooltip tooltipContent={issueDetails?.name} isMobile={isMobile}>
          <span className="flex-grow truncate text-13 font-medium">{issueDetails?.name}</span>
        </Tooltip>
      </div>
    </ControlLink>
  );
});
