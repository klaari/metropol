interface DividerProps {
  /** Indent the divider from the left edge by this many pixels. */
  indent?: number;
}

export function Divider({ indent = 0 }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className="h-hair bg-paper-edge"
      style={indent ? { marginLeft: indent } : undefined}
    />
  );
}
