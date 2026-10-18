"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import CardCollapseButton from "@/components/request-collections/CardCollapseButton";

interface Props {
  label: string;
  expandedClassName: string;
  header: (collapsed: boolean) => ReactNode;
  children: ReactNode;
}

export default function CollapsibleCard({ label, expandedClassName, header, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const animations = useRef<Animation[]>([]);
  const transitioning = useRef(false);
  const openingHeight = useRef<number | null>(null);
  const resizedHeight = useRef("");

  function clearAnimations() {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    transitioning.current = false;
  }

  function animateHeight(from: number, to: number, opening: boolean) {
    const section = sectionRef.current!;
    transitioning.current = true;
    const options = { duration: 360, easing: "ease-in-out", fill: "forwards" as const };
    const height = section.animate([
      { height: `${from}px`, minHeight: "0px", maxHeight: "none", overflow: "hidden" },
      { height: `${to}px`, minHeight: "0px", maxHeight: "none", overflow: "hidden" },
    ], options);
    const content = Array.from(section.children).slice(1).map((child) => child.animate(
      [{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }], options
    ));
    animations.current = [height, ...content];
    return Promise.all(animations.current.map((animation) => animation.finished));
  }

  useLayoutEffect(() => {
    if (collapsed) {
      clearAnimations();
    } else if (openingHeight.current !== null) {
      const from = openingHeight.current;
      openingHeight.current = null;
      const section = sectionRef.current!;
      section.style.height = resizedHeight.current;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      void animateHeight(from, section.getBoundingClientRect().height, true)
        .then(clearAnimations).catch(() => {});
    }
  }, [collapsed]);

  useEffect(() => () => clearAnimations(), []);

  function toggle() {
    if (transitioning.current) return;
    const section = sectionRef.current!;
    const from = section.getBoundingClientRect().height;
    if (collapsed) {
      openingHeight.current = from;
      setCollapsed(false);
      return;
    }
    resizedHeight.current = section.style.height;
    const finish = () => { section.style.height = ""; setCollapsed(true); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const style = getComputedStyle(section);
    const to = section.firstElementChild!.getBoundingClientRect().height
      + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    void animateHeight(from, to, false).then(finish).catch(() => {});
  }

  return (
    <section
      ref={sectionRef}
      title={collapsed ? undefined : "Drag the bottom-right corner to resize"}
      className={`${collapsed ? "" : expandedClassName} rounded-lg border border-gray-200 bg-white p-4 shadow-sm`}
    >
      <div className="flex min-w-0 shrink-0 items-center justify-between gap-3">
        {header(collapsed)}
        <CardCollapseButton collapsed={collapsed} label={label} onToggle={toggle} />
      </div>
      {!collapsed && children}
    </section>
  );
}
