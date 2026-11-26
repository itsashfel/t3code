export type ListTreeItem<Row> =
  | {
      readonly kind: "row";
      readonly row: Row;
      readonly children: ReadonlyArray<ListTreeItem<Row>>;
    }
  | {
      /** Stands in for a parent the list does not hold, so its children still sit together. */
      readonly kind: "context";
      readonly parentKey: string;
      readonly first: Row;
      readonly children: ReadonlyArray<ListTreeItem<Row>>;
    };

/**
 * Nests rows under the row their parent key names, keeping the list's order: a parent stays where
 * it was, its children follow it in their own order, and children of an unlisted parent gather
 * where the first of them stood.
 */
export function nestListRows<Row>(
  rows: ReadonlyArray<Row>,
  keyOf: (row: Row) => string,
  parentKeyOf: (row: Row) => string | undefined,
): ReadonlyArray<ListTreeItem<Row>> {
  const listed = new Set(rows.map((row) => keyOf(row)));
  const childrenOf = new Map<string, Row[]>();
  const roots: Array<
    { kind: "row"; row: Row } | { kind: "context"; parentKey: string; first: Row }
  > = [];
  for (const row of rows) {
    const parentKey = parentKeyOf(row);
    if (parentKey === undefined || parentKey === keyOf(row)) {
      roots.push({ kind: "row", row });
      continue;
    }
    const siblings = childrenOf.get(parentKey);
    if (siblings) siblings.push(row);
    else {
      childrenOf.set(parentKey, [row]);
      if (!listed.has(parentKey)) roots.push({ kind: "context", parentKey, first: row });
    }
  }

  const placed = new Set<string>();
  const childrenUnder = (parentKey: string): ReadonlyArray<ListTreeItem<Row>> =>
    (childrenOf.get(parentKey) ?? []).flatMap((row) => {
      const key = keyOf(row);
      if (placed.has(key)) return [];
      placed.add(key);
      return [{ kind: "row" as const, row, children: childrenUnder(key) }];
    });

  const items: Array<ListTreeItem<Row>> = roots.map((root) => {
    if (root.kind === "context") {
      return { ...root, children: childrenUnder(root.parentKey) };
    }
    const key = keyOf(root.row);
    placed.add(key);
    return { kind: "row", row: root.row, children: childrenUnder(key) };
  });
  // Rows whose parents only lead back to themselves still show, at the top level.
  for (const row of rows) {
    const key = keyOf(row);
    if (placed.has(key)) continue;
    placed.add(key);
    items.push({ kind: "row", row, children: childrenUnder(key) });
  }
  return items;
}
