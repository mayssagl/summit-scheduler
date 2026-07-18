import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Chip-style editor for a training's ordered module list (the chapters of a
// training, e.g. "1. Framing", "2. Anchoring"). Array position is the module
// number — there's no separate "position" field, so reordering the chips is
// what renumbers them.
export function ModuleChips({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const name = draft.trim();
    if (!name || value.includes(name)) return;
    onChange([...value, name]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= value.length) return;
    const copy = [...value];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((m, i) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-full border border-input py-1 pl-1 pr-2 text-xs font-medium"
            >
              <span className="flex flex-col">
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move "${m}" earlier`}
                  className="grid h-3 w-3 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-25"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || i === value.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move "${m}" later`}
                  className="grid h-3 w-3 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </span>
              <span>{i + 1}. {m}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(i)}
                aria-label={`Remove "${m}"`}
                className={cn("ml-0.5 grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive", disabled && "pointer-events-none opacity-50")}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Module name, e.g. Framing"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || !draft.trim()} onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" />Add
        </Button>
      </div>
    </div>
  );
}
