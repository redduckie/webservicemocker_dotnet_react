interface Props {
  collapsed: boolean;
  label: string;
  onToggle: () => void;
}

export default function CardCollapseButton({ collapsed, label, onToggle }: Props) {
  const action = collapsed ? "Expand" : "Collapse";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={`${action} ${label}`}
      title={`${action} ${label}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
    >
      <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m5 12.5 5-5 5 5" />
      </svg>
    </button>
  );
}
