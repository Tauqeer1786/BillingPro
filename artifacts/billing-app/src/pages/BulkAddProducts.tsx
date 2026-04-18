import { useState, useRef, KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, CheckCircle2, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkRow {
  key: string;
  name: string;
  quantity: string;
  costPrice: string;
  sellingPrice: string;
  gstPercent: string;
  hsn: string;
  unit: string;
  error?: string;
}

function emptyRow(): BulkRow {
  return {
    key: crypto.randomUUID(),
    name: "",
    quantity: "",
    costPrice: "",
    sellingPrice: "",
    gstPercent: "",
    hsn: "",
    unit: "pcs",
    error: undefined,
  };
}

const COLUMNS = ["name", "quantity", "costPrice", "sellingPrice", "gstPercent", "hsn", "unit"] as const;
type ColKey = typeof COLUMNS[number];

const COLUMN_LABELS: Record<ColKey, string> = {
  name: "Product Name *",
  quantity: "Qty *",
  costPrice: "Cost Price (₹) *",
  sellingPrice: "Selling Price (₹) *",
  gstPercent: "GST %",
  hsn: "HSN Code",
  unit: "Unit",
};

const COLUMN_WIDTHS: Record<ColKey, string> = {
  name: "min-w-44",
  quantity: "w-20",
  costPrice: "w-28",
  sellingPrice: "w-28",
  gstPercent: "w-20",
  hsn: "w-28",
  unit: "w-20",
};

function validateRow(row: BulkRow): string | undefined {
  if (!row.name.trim()) return "Product name is required";
  if (!row.quantity || Number(row.quantity) < 0) return "Quantity must be ≥ 0";
  if (!row.costPrice || Number(row.costPrice) < 0) return "Cost price must be ≥ 0";
  if (!row.sellingPrice || Number(row.sellingPrice) < 0) return "Selling price must be ≥ 0";
  return undefined;
}

export function BulkAddProducts() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BulkRow[]>(() => Array.from({ length: 10 }, emptyRow));
  const [submitted, setSubmitted] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);

  const mutation = useMutation({
    mutationFn: (products: object[]) =>
      customFetch("/api/products/bulk", {
        method: "POST",
        body: JSON.stringify({ products }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function updateRow(key: string, field: Partial<BulkRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...field, error: undefined } : r));
  }

  function addRows(count = 5) {
    setRows(prev => [...prev, ...Array.from({ length: count }, emptyRow)]);
  }

  function removeRow(key: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.key !== key) : [emptyRow()]);
  }

  function clearAll() {
    if (confirm("Clear all rows?")) setRows(Array.from({ length: 10 }, emptyRow));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Tab" || e.key === "Enter") {
      if (e.key === "Enter") e.preventDefault();
      const cells = tableRef.current?.querySelectorAll<HTMLInputElement>("tbody input");
      if (!cells) return;
      const currentIdx = rowIdx * COLUMNS.length + colIdx;
      const nextIdx = currentIdx + 1;
      if (nextIdx < cells.length) {
        cells[nextIdx].focus();
      } else if (rowIdx === rows.length - 1) {
        addRows(5);
        setTimeout(() => {
          const newCells = tableRef.current?.querySelectorAll<HTMLInputElement>("tbody input");
          newCells?.[nextIdx]?.focus();
        }, 50);
      }
    }
  }

  const filledRows = rows.filter(r => r.name.trim());

  async function handleSubmit() {
    const validated = rows.map(r => ({ ...r, error: validateRow(r) }));
    const filledWithErrors = validated.filter(r => r.name.trim());
    const hasErrors = filledWithErrors.some(r => r.error);

    if (hasErrors) {
      setRows(validated);
      toast({ title: "Fix validation errors before saving", variant: "destructive" });
      return;
    }

    const toSubmit = filledWithErrors;
    if (toSubmit.length === 0) {
      toast({ title: "No products to save", description: "Fill in at least one row.", variant: "destructive" });
      return;
    }

    try {
      const result = await mutation.mutateAsync(
        toSubmit.map(r => ({
          name: r.name.trim(),
          quantity: Number(r.quantity) || 0,
          costPrice: Number(r.costPrice) || 0,
          sellingPrice: Number(r.sellingPrice) || 0,
          gstPercent: Number(r.gstPercent) || 0,
          hsn: r.hsn.trim() || undefined,
          unit: r.unit.trim() || "pcs",
        }))
      ) as { created: number };
      setSubmitted(true);
      toast({ title: `${result.created} product(s) added!`, description: "All rows saved to inventory." });
    } catch {
      toast({ title: "Failed to save products", variant: "destructive" });
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <div className="text-center">
          <h2 className="text-2xl font-bold">Products Added!</h2>
          <p className="text-muted-foreground mt-1">All products have been saved to your inventory.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { setRows(Array.from({ length: 10 }, emptyRow)); setSubmitted(false); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add More
          </Button>
          <Button variant="outline" onClick={() => navigate("/products")}>
            View Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/products")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PackagePlus className="w-6 h-6" />
            Bulk Add Products
          </h1>
          <p className="text-sm text-muted-foreground">Fill rows like a spreadsheet. Press Tab or Enter to move between cells.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">Product Table</CardTitle>
              <CardDescription>{filledRows.length} row(s) with data · {rows.length} total rows</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addRows(5)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add 5 Rows
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8 text-center">#</th>
                  {COLUMNS.map(col => (
                    <th key={col} className={cn("text-left px-2 py-2 font-medium text-muted-foreground", COLUMN_WIDTHS[col])}>
                      {COLUMN_LABELS[col]}
                    </th>
                  ))}
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, rowIdx) => (
                  <tr key={row.key} className={cn("hover:bg-muted/20", row.error && "bg-red-50 dark:bg-red-950/20")}>
                    <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">{rowIdx + 1}</td>
                    {COLUMNS.map((col, colIdx) => (
                      <td key={col} className="px-1.5 py-1.5">
                        <Input
                          type={["quantity", "costPrice", "sellingPrice", "gstPercent"].includes(col) ? "number" : "text"}
                          min={0}
                          step={["costPrice", "sellingPrice"].includes(col) ? "0.01" : undefined}
                          className={cn(
                            "h-7 text-sm px-2",
                            row.error && col === "name" && !row.name.trim() && "border-red-400",
                            row.error && col === "quantity" && !row.quantity && "border-red-400",
                          )}
                          placeholder={col === "unit" ? "pcs" : col === "gstPercent" ? "0" : ""}
                          value={row[col]}
                          onChange={e => updateRow(row.key, { [col]: e.target.value })}
                          onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                        />
                      </td>
                    ))}
                    <td className="px-1.5 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.key)}
                        tabIndex={-1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.some(r => r.error) && (
            <div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border-t">
              {rows.filter(r => r.error).map(r => (
                <div key={r.key}>Row {rows.indexOf(r) + 1}: {r.error}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSubmit} disabled={mutation.isPending || filledRows.length === 0} size="lg">
          {mutation.isPending ? "Saving..." : `Save ${filledRows.length} Product${filledRows.length !== 1 ? "s" : ""}`}
        </Button>
        <Button variant="outline" onClick={() => navigate("/products")}>Cancel</Button>
        <span className="text-sm text-muted-foreground">Only filled rows will be saved.</span>
      </div>
    </div>
  );
}
