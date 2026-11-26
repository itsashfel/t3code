import { describe, expect, it } from "vite-plus/test";

import { nestListRows, type ListTreeItem } from "./nestListRows";

interface Row {
  readonly key: string;
  readonly parent?: string;
}

const nest = (rows: ReadonlyArray<Row>) =>
  nestListRows(
    rows,
    (row) => row.key,
    (row) => row.parent,
  );

const shape = (items: ReadonlyArray<ListTreeItem<Row>>): unknown[] =>
  items.map((item) =>
    item.kind === "row"
      ? item.children.length === 0
        ? item.row.key
        : [item.row.key, shape(item.children)]
      : [`(${item.parentKey})`, shape(item.children)],
  );

describe("nestListRows", () => {
  it("puts children under a listed parent wherever either stood", () => {
    expect(
      shape(
        nest([
          { key: "c1", parent: "p" },
          { key: "a" },
          { key: "p" },
          { key: "c2", parent: "p" },
          { key: "g", parent: "c2" },
        ]),
      ),
    ).toEqual(["a", ["p", ["c1", ["c2", ["g"]]]]]);
  });

  it("gathers children of an unlisted parent where the first of them stood", () => {
    expect(
      shape(
        nest([{ key: "a" }, { key: "c1", parent: "x" }, { key: "b" }, { key: "c2", parent: "x" }]),
      ),
    ).toEqual(["a", ["(x)", ["c1", "c2"]], "b"]);
  });

  it("calls keyOf with the row alone, so optional parameters keep their defaults", () => {
    const keyOf = (row: Row, prefix = "k:") => `${prefix}${row.key}`;
    const items = nestListRows([{ key: "p" }, { key: "c", parent: "p" }], keyOf, (row) =>
      row.parent === undefined ? undefined : keyOf({ key: row.parent }),
    );
    expect(items.map((item) => item.kind)).toEqual(["row"]);
  });

  it("keeps rows whose parents loop back to themselves", () => {
    expect(
      shape(
        nest([
          { key: "a", parent: "b" },
          { key: "b", parent: "a" },
          { key: "s", parent: "s" },
        ]),
      ),
    ).toEqual(["s", ["a", ["b"]]]);
  });
});
