import React, { useMemo, useCallback } from "react";

/**
 * Triple mouse-wheel spinner for selecting LLM backends.
 *
 * - Wheel: rotates only the hovered slot
 * - Shift+Wheel: rotates all three slots together
 * - Optional uniqueness enforcement: prevents primary/secondary/backup duplicates
 */
export function LlmTripleSpinner({
  allowed = [],
  value = { primary: "", secondary: "", backup: "" },
  onChange,
  label = "LLM Backends",
  enforceUnique = true,
  getLabel = (id) => String(id || ''),
}) {
  const list = useMemo(() => (Array.isArray(allowed) ? allowed : []), [allowed]);

  const idxOf = useCallback(
    (v) => {
      const i = list.indexOf(v);
      return i >= 0 ? i : 0;
    },
    [list]
  );

  const pickByIndex = useCallback(
    (i) => {
      if (!list.length) return "";
      const n = list.length;
      const ii = ((i % n) + n) % n;
      return list[ii];
    },
    [list]
  );

  const makeUnique = useCallback(
    (sel) => {
      if (!enforceUnique || list.length < 2) return sel;

      let { primary, secondary, backup } = sel;
      // If any are unset, set to first items (and keep unique if possible)
      if (!primary) primary = list[0];
      if (!secondary) secondary = list[Math.min(1, list.length - 1)];
      if (!backup) backup = list[Math.min(2, list.length - 1)];

      const used = new Set();
      const next = { primary, secondary, backup };

      // Helper rotates forward until unique or we've tried all
      const uniq = (slot, start) => {
        let cur = start;
        for (let k = 0; k < list.length; k++) {
          if (!used.has(cur)) return cur;
          cur = pickByIndex(idxOf(cur) + 1);
        }
        return start; // fall back (shouldn't happen)
      };

      next.primary = uniq("primary", next.primary); used.add(next.primary);
      next.secondary = uniq("secondary", next.secondary); used.add(next.secondary);
      next.backup = uniq("backup", next.backup); used.add(next.backup);

      return next;
    },
    [enforceUnique, list, pickByIndex, idxOf]
  );

  const rotateOne = useCallback(
    (slot, delta) => {
      if (!list.length) return;
      const cur = value?.[slot] ?? list[0];
      const next = { ...value, [slot]: pickByIndex(idxOf(cur) + delta) };
      onChange?.(makeUnique(next));
    },
    [value, list, idxOf, pickByIndex, onChange, makeUnique]
  );

  const rotateAll = useCallback(
    (delta) => {
      if (!list.length) return;
      const next = {
        primary: pickByIndex(idxOf(value?.primary ?? list[0]) + delta),
        secondary: pickByIndex(idxOf(value?.secondary ?? list[0]) + delta),
        backup: pickByIndex(idxOf(value?.backup ?? list[0]) + delta),
      };
      onChange?.(makeUnique(next));
    },
    [value, list, idxOf, pickByIndex, onChange, makeUnique]
  );

  const wheelHandler = useCallback(
    (slot) => (e) => {
      e.preventDefault();
      if (!list.length) return;
      const delta = e.deltaY > 0 ? 1 : -1;
      if (e.shiftKey) rotateAll(delta);
      else rotateOne(slot, delta);
    },
    [list, rotateAll, rotateOne]
  );

  const Slot = ({ slotKey, title }) => (
    <div style={{ border: "1px solid var(--color-surface-border)", borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div
        onWheel={wheelHandler(slotKey)}
        title="Mouse wheel to rotate. Shift+wheel rotates all three."
        style={{
          userSelect: "none",
          cursor: "ns-resize",
          borderRadius: 12,
          padding: 10,
          background: "var(--color-surface)",
          border: "1px solid var(--color-surface-border)",
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: 12
        }}
      >
        {value?.[slotKey] ? getLabel(value?.[slotKey]) : "(unset)"}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
        Wheel = rotate this • Shift+Wheel = rotate all
      </div>
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--color-surface-border)", borderRadius: 18, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>Allowed: {list.length}</div>
      </div>

      {!list.length ? (
        <div style={{ fontSize: 12, opacity: 0.8 }}>No allowed backends configured for this agent.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Slot slotKey="primary" title="Primary" />
          <Slot slotKey="secondary" title="Secondary" />
          <Slot slotKey="backup" title="Backup" />
        </div>
      )}
    </div>
  );
}
