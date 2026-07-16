/**
 * Minardi fork: frecce di dipendenza sulla timeline a corsie impacchettate (stile Asana).
 *
 * In Plane CE il layer dipendenze della Gantt (TimelineDependencyPaths) è uno stub vuoto
 * (feature EE) e comunque non copre la modalità packed. Qui disegniamo noi i connettori:
 * per ogni blocco, i predecessori sono le relazioni `blocked_by` (relationMap, popolata in
 * bulk dal payload issues-detail via extractRelationsFromIssues). Il connettore esce dal
 * bordo destro del predecessore ed entra con una freccia nel bordo sinistro del dipendente;
 * se il dipendente inizia PRIMA della fine del predecessore (date in conflitto) il
 * connettore è rosso, come in Asana.
 *
 * Layer SVG assoluto sotto le barre (z-4 < z-5), pointer-events-none: non interferisce
 * con hover/drag. Le coordinate sono le stesse di packed-bands: left/width dal chart
 * store, y dal packing globale (sotto-riga) + top cumulativo delle bande.
 */
import { observer } from "mobx-react";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useTimeLineChartStore } from "@/hooks/use-timeline-chart";
import { BLOCK_HEIGHT } from "../constants";
import type { TPackedSection } from "../contexts/group-context";
import { PACKED_HEADER_HEIGHT } from "./packed-layout";

// sporgenza orizzontale del connettore prima/dopo le curve (px)
const STUB = 8;
// dimensione della punta freccia (px)
const ARROW = 5;

type TBarGeom = { left: number; right: number; yCenter: number };

type Props = {
  sections: TPackedSection[];
  bandTops: Record<string, number>;
  totalHeight: number;
  itemsContainerWidth: number;
};

// percorso a gomiti dal bordo destro del predecessore al bordo sinistro del dipendente
const buildConnector = (from: TBarGeom, to: TBarGeom): { d: string; conflict: boolean } => {
  const x1 = from.right;
  const y1 = from.yCenter;
  const x2 = to.left;
  const y2 = to.yCenter;
  const conflict = x2 < x1;
  let d: string;
  if (x2 - x1 >= STUB * 2) {
    // caso normale: esce a destra, scende/sale alla riga del dipendente, entra da sinistra
    d = `M ${x1} ${y1} H ${x1 + STUB} V ${y2} H ${x2 - ARROW}`;
  } else {
    // il dipendente inizia più a sinistra: percorso a "Z" passando dal bordo della riga
    const midY = y2 >= y1 ? y1 + BLOCK_HEIGHT / 2 : y1 - BLOCK_HEIGHT / 2;
    d = `M ${x1} ${y1} H ${x1 + STUB} V ${midY} H ${x2 - STUB} V ${y2} H ${x2 - ARROW}`;
  }
  return { d, conflict };
};

export const PackedDependencyPaths = observer(function PackedDependencyPaths(props: Props) {
  const { sections, bandTops, totalHeight, itemsContainerWidth } = props;
  const { getBlockById } = useTimeLineChartStore();
  const {
    relation: { getRelationByIssueIdRelationType },
  } = useIssueDetail();

  // geometria di tutte le barre nelle sezioni espanse (coordinate identiche a packed-bar)
  const geometry = new Map<string, TBarGeom>();
  for (const section of sections) {
    if (section.isCollapsed) continue;
    const bandTop = bandTops[section.id] ?? 0;
    for (const id of section.blockIds) {
      const pos = getBlockById(id)?.position;
      if (!pos) continue;
      const subRow = section.subRowByBlockId[id] ?? 0;
      geometry.set(id, {
        left: pos.marginLeft,
        right: pos.marginLeft + pos.width,
        yCenter: bandTop + PACKED_HEADER_HEIGHT + subRow * BLOCK_HEIGHT + BLOCK_HEIGHT / 2,
      });
    }
  }

  const connectors: { key: string; d: string; conflict: boolean; tipX: number; tipY: number }[] = [];
  for (const [blockId, dep] of geometry) {
    const predecessorIds = getRelationByIssueIdRelationType(blockId, "blocked_by");
    if (!predecessorIds?.length) continue;
    for (const predecessorId of predecessorIds) {
      const pred = geometry.get(predecessorId);
      if (!pred) continue;
      const { d, conflict } = buildConnector(pred, dep);
      connectors.push({ key: `${predecessorId}>${blockId}`, d, conflict, tipX: dep.left, tipY: dep.yCenter });
    }
  }

  if (!connectors.length) return null;

  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 z-[4]"
      width={itemsContainerWidth}
      height={totalHeight}
      aria-hidden
    >
      {connectors.map((c) => (
        // linea scura continua (stile mockup); rossa se le date sono in conflitto
        <g key={c.key} className={c.conflict ? "text-danger-primary" : "text-secondary"}>
          <path
            d={c.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinejoin="round"
            opacity={c.conflict ? 0.95 : 0.8}
          />
          {/* punta della freccia sul bordo sinistro del dipendente */}
          <path
            d={`M ${c.tipX} ${c.tipY} l ${-ARROW} ${-ARROW} v ${ARROW * 2} z`}
            fill="currentColor"
            opacity={c.conflict ? 0.95 : 0.8}
          />
        </g>
      ))}
    </svg>
  );
});
