/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { ALL_ISSUES, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { EIssuesStoreType, IBlockUpdateData, TIssue } from "@plane/types";
import { EIssueLayoutTypes, GANTT_TIMELINE_TYPE } from "@plane/types";
import { renderFormattedPayloadDate } from "@plane/utils";
// components
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
// Minardi fork: contesto per le corsie raggruppate sulla timeline
import { GanttGroupContext, type TPackedSection } from "@/components/gantt-chart/contexts/group-context";
import { GanttChartRoot } from "@/components/gantt-chart/root";
import { IssueGanttSidebar } from "@/components/gantt-chart/sidebar/issues/sidebar";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useLabel } from "@/hooks/store/use-label";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
// plane web hooks
import { useBulkOperationStatus } from "@/plane-web/hooks/use-bulk-operation-status";

import { IssueLayoutHOC } from "../issue-layout-HOC";
import { GanttQuickAddIssueButton, QuickAddIssueRoot } from "../quick-add";
import { IssueGanttBlock } from "./blocks";

interface IBaseGanttRoot {
  viewId?: string | undefined;
  isCompletedCycle?: boolean;
  isEpic?: boolean;
}

export type GanttStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.EPIC;

export const BaseGanttRoot = observer(function BaseGanttRoot(props: IBaseGanttRoot) {
  const { viewId, isCompletedCycle = false, isEpic = false } = props;
  const { t } = useTranslation();
  // router
  const { workspaceSlug, projectId } = useParams();

  const storeType = useIssueStoreType() as GanttStoreType;
  const { issues, issuesFilter } = useIssues(storeType);
  const { fetchIssues, fetchNextIssues, updateIssue, quickAddIssue } = useIssuesActions(storeType);
  const { initGantt } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  // store hooks
  const { allowPermissions } = useUserPermissions();

  const appliedDisplayFilters = issuesFilter.issueFilters?.displayFilters;
  // plane web hooks
  const isBulkOperationsEnabled = useBulkOperationStatus();
  // derived values
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);

  useEffect(() => {
    fetchIssues("init-loader", { canGroup: false, perPageCount: 500 }, viewId);
  }, [fetchIssues, storeType, viewId]);

  useEffect(() => {
    initGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Minardi fork: lista piatta degli id issue. Normalmente sta in ALL_ISSUES; ma se un
  // group_by nei filtri fa ripartire le issue nei bucket (ALL_ISSUES vuoto), appiattiamo
  // e deduplichiamo tutti i bucket per riottenere la lista piatta (il grouping a corsie è client-side).
  const issuesIds = useMemo(() => {
    const grouped = (issues.groupedIssueIds || {}) as Record<string, string[]>;
    const all = grouped[ALL_ISSUES];
    if (all && all.length > 0) return all;
    const flat = new Set<string>();
    for (const [key, ids] of Object.entries(grouped)) {
      if (key === ALL_ISSUES || !Array.isArray(ids)) continue;
      for (const id of ids) flat.add(id);
    }
    return Array.from(flat);
  }, [issues.groupedIssueIds]);
  const nextPageResults = issues.getPaginationData(undefined, undefined)?.nextPageResults;

  // ─── Minardi fork: corsie raggruppate sulla timeline ────────────────────────
  // La Gantt di Plane 1.3.1 è piatta (canGroup:false / ALL_ISSUES). Qui calcoliamo
  // i gruppi client-side dal group_by scelto e iniettiamo delle "sentinelle" di
  // intestazione in blockIds; le liste (sidebar/RowList/BlocksList) le riconoscono
  // e rendono le righe-corsia allineate.
  const groupBy = appliedDisplayFilters?.group_by ?? null;
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getLabelById } = useLabel();
  const { getStateById } = useProjectState();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const { packedSections, groupingEnabled } = useMemo(() => {
    const supported = groupBy === "state" || groupBy === "labels";
    if (!supported) return { packedSections: [] as TPackedSection[], groupingEnabled: false };

    // chiave + nome del gruppo per una issue (single-membership per corsie pulite)
    const groupOf = (issueId: string): { key: string; name: string } => {
      const issue = getIssueById(issueId);
      if (!issue) return { key: "__none__", name: "Senza gruppo" };
      if (groupBy === "state") {
        const st = issue.state_id ? getStateById(issue.state_id) : undefined;
        return { key: issue.state_id ?? "__none__", name: st?.name ?? "Senza stato" };
      }
      // Raggruppa SOLO per etichetta di sezione (prefisso "sez:"). Niente fallback su una
      // label qualsiasi: i task con un tag ma senza sezione (es. tag "PCK COMPLETED") NON
      // devono creare sezioni-fantasma → finiscono in "Senza sezione", come in Asana.
      const labelIds = issue.label_ids ?? [];
      const chosen = labelIds.map((id) => getLabelById(id)).find((l) => l?.name?.startsWith("sez:"));
      const name = (chosen?.name ?? "Senza sezione").replace(/^sez:/, "");
      return { key: chosen?.id ?? "__none__", name };
    };

    const order: string[] = [];
    const byGroup: Record<string, { name: string; ids: string[] }> = {};
    for (const id of issuesIds) {
      const { key, name } = groupOf(id);
      if (!byGroup[key]) {
        byGroup[key] = { name, ids: [] };
        order.push(key);
      }
      byGroup[key].ids.push(id);
    }
    if (order.length <= 1) return { packedSections: [] as TPackedSection[], groupingEnabled: false };

    // Packing per sezione: interval partitioning sulle date (start/target).
    const sections: TPackedSection[] = order.map((key) => {
      const g = byGroup[key];
      const withDates: { id: string; start: string; end: string }[] = [];
      let noDateCount = 0;
      for (const id of g.ids) {
        const iss = getIssueById(id);
        if (iss && (iss.start_date || iss.target_date)) {
          const s = (iss.start_date ?? iss.target_date) as string;
          const e = (iss.target_date ?? iss.start_date) as string;
          withDates.push({ id, start: s, end: e });
        } else noDateCount++;
      }
      withDates.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      const rowEnds: string[] = []; // ultima end per sotto-riga
      const subRowByBlockId: Record<string, number> = {};
      for (const w of withDates) {
        let placed = rowEnds.findIndex((end) => end < w.start);
        if (placed === -1) {
          placed = rowEnds.length;
          rowEnds.push(w.end);
        } else rowEnds[placed] = w.end;
        subRowByBlockId[w.id] = placed;
      }
      return {
        id: key,
        name: g.name,
        count: g.ids.length,
        isCollapsed: collapsedGroups.has(key),
        rowCount: Math.max(1, rowEnds.length),
        blockIds: withDates.map((w) => w.id),
        subRowByBlockId,
        noDateCount,
      };
    });
    return { packedSections: sections, groupingEnabled: true };
  }, [issuesIds, groupBy, collapsedGroups, getIssueById, getLabelById, getStateById]);

  const groupContextValue = useMemo(
    () => ({
      enabled: groupingEnabled,
      packed: groupingEnabled,
      sections: packedSections,
      headers: {},
      toggleGroup,
    }),
    [groupingEnabled, packedSections, toggleGroup]
  );
  // ─────────────────────────────────────────────────────────────────────────

  const { enableIssueCreation } = issues?.viewFlags || {};

  const loadMoreIssues = useCallback(() => {
    fetchNextIssues();
  }, [fetchNextIssues]);

  const updateIssueBlockStructure = async (issue: TIssue, data: IBlockUpdateData) => {
    if (!workspaceSlug) return;

    const payload: any = { ...data };
    if (data.sort_order) payload.sort_order = data.sort_order.newSortOrder;

    if (updateIssue) await updateIssue(issue.project_id, issue.id, payload);
  };

  const isAllowed = allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.PROJECT);
  const updateBlockDates = useCallback(
    (
      updates: {
        id: string;
        start_date?: string;
        target_date?: string;
      }[]
    ) =>
      issues.updateIssueDates(workspaceSlug.toString(), updates, projectId.toString()).catch(() => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("toast.error"),
          message: "Error while updating work item dates, Please try again Later",
        });
      }),
    [issues, projectId, workspaceSlug, t]
  );

  const quickAdd =
    enableIssueCreation && isAllowed && !isCompletedCycle ? (
      <QuickAddIssueRoot
        layout={EIssueLayoutTypes.GANTT}
        QuickAddButton={GanttQuickAddIssueButton}
        containerClassName="sticky bottom-0 z-[1]"
        prePopulatedData={{
          start_date: renderFormattedPayloadDate(new Date()),
          target_date: renderFormattedPayloadDate(targetDate),
        }}
        quickAddCallback={quickAddIssue}
        isEpic={isEpic}
      />
    ) : undefined;

  return (
    <IssueLayoutHOC layout={EIssueLayoutTypes.GANTT}>
      <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.ISSUE}>
        <GanttGroupContext.Provider value={groupContextValue}>
          <div className="h-full w-full">
            <GanttChartRoot
              border={false}
              title={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
              loaderTitle={isEpic ? t("epic.label", { count: 2 }) : t("issue.label", { count: 2 })}
              blockIds={issuesIds}
              blockUpdateHandler={updateIssueBlockStructure}
              blockToRender={(data: TIssue) => (
                <IssueGanttBlock issueId={data.id} isEpic={isEpic} labelOutside={groupingEnabled} />
              )}
              sidebarToRender={(sidebarProps) => <IssueGanttSidebar {...sidebarProps} showAllBlocks isEpic={isEpic} />}
              enableBlockLeftResize={isAllowed}
              enableBlockRightResize={isAllowed}
              enableBlockMove={isAllowed}
              enableReorder={appliedDisplayFilters?.order_by === "sort_order" && isAllowed}
              enableAddBlock={isAllowed}
              enableSelection={isBulkOperationsEnabled && isAllowed}
              quickAdd={quickAdd}
              loadMoreBlocks={loadMoreIssues}
              canLoadMoreBlocks={nextPageResults}
              updateBlockDates={updateBlockDates}
              showAllBlocks
              enableDependency
              isEpic={isEpic}
            />
          </div>
        </GanttGroupContext.Provider>
      </TimeLineTypeContext.Provider>
    </IssueLayoutHOC>
  );
});
