"use client";

import { useState, type ReactNode } from "react";

export default function AnimatedDisclosure({ open, children }: { open: boolean; children: () => ReactNode }) {
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);
  return (
    <div className="animated-disclosure" data-open={open} inert={!open} aria-hidden={!open}>
      <div className="animated-disclosure-inner">{hasOpened ? children() : null}</div>
    </div>
  );
}
