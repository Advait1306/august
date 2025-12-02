import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: any;
  className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  const renderValue = (value: any): React.ReactNode => {
    if (value === null) {
      return <span className="text-muted-foreground">null</span>;
    }
    if (typeof value === "boolean") {
      return <span className="text-blue-500">{value.toString()}</span>;
    }
    if (typeof value === "number") {
      return <span className="text-green-500">{value}</span>;
    }
    if (typeof value === "string") {
      return <span className="text-orange-500">"{value}"</span>;
    }
    if (Array.isArray(value)) {
      return <span className="text-muted-foreground">[...]</span>;
    }
    if (typeof value === "object") {
      return (
        <span className="text-muted-foreground">
          {"{"}...{"}"}
        </span>
      );
    }
    return String(value);
  };

  const entries = Object.entries(data);

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-md text-xs [&_table]:w-full bg-muted/50 p-2",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="font-medium text-foreground">{key}:</span>
            {renderValue(value)}
          </div>
        ))}
      </div>
    </div>
  );
}
