import { useState } from "react";

import cn from "~/utils/cn";

export interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

export default function Avatar({ name, src, className }: AvatarProps) {
  const [isBroken, setIsBroken] = useState(false);
  const classes = cn(
    "inline-grid size-7 shrink-0 place-items-center overflow-hidden rounded-full",
    "border border-line bg-subtle text-[11px] font-semibold text-muted",
    className,
  );

  if (!src || isBroken) {
    return (
      <span aria-label={name} className={classes} role="img">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      alt={name}
      className={classes}
      onError={() => setIsBroken(true)}
      // An image that fails before hydration never fires onError.
      ref={(img) => {
        if (img?.complete && img.naturalWidth === 0) {
          setIsBroken(true);
        }
      }}
      src={src}
    />
  );
}
