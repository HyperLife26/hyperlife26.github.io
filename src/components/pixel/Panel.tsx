import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  kicker?: ReactNode;
  action?: ReactNode;
  as?: "section" | "div" | "aside";
}

/** Double-framed pixel panel. `kicker` = small sky label, `title` = big heading. */
export function Panel({ title, kicker, action, className, children, as: Tag = "section", ...rest }: PanelProps) {
  return (
    <Tag className={cn("pixel-panel p-5", className)} {...rest}>
      {(title || kicker || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {kicker && <p className="pixel-label text-sky">{kicker}</p>}
            {title && <h2 className="mt-1 text-3xl leading-none text-foreground">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
