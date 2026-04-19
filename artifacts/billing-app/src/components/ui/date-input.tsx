import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export function DateInput({ value, onChange, className, required }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  const displayValue = value
    ? value.split("-").reverse().join("/")
    : "";

  function openPicker() {
    const el = hiddenRef.current;
    if (!el) return;
    if (el.showPicker) {
      try { el.showPicker(); } catch { el.click(); }
    } else {
      el.click();
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        value={displayValue}
        readOnly
        placeholder="DD/MM/YYYY"
        onClick={openPicker}
        className="cursor-pointer"
        required={required}
      />
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}
