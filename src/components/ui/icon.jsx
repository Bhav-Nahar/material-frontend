import { cn } from "@/lib/utils";

/**
 * Interface icons, per §03.
 *
 * "Interface icons are not the brand mark's family. They are a separate, quieter system: 1.5px
 * stroke, 24px grid, square terminals, no fills. Draw from a single open set (Lucide or Phosphor)
 * rather than mixing sources."
 *
 * This wrapper exists so those rules hold by construction rather than by memory. §03 allows exactly
 * three sizes -- 16, 20, 24, "no other sizes" -- and a 1.5px stroke because that is what "holds up
 * beside IBM Plex at 14.5px". The header it replaced had five hand-drawn SVGs on four different
 * grids (20, 19, 18x17, 16x19) at varying weights, which is the drift this prevents.
 *
 * Colour is charcoal or gray, NEVER orange: "orange marks the action, and an icon on its own isn't
 * one." An icon inside an orange button inherits --on-action from the button instead.
 *
 * Usage:  <Icon as={ShoppingBag} />           charcoal, 20px
 *         <Icon as={Heart} size={24} muted /> gray, 24px
 */
const SIZES = { 16: "size-4", 20: "size-5", 24: "size-6" };

export function Icon({ as: Glyph, size = 20, muted = false, className, ...props }) {
  return (
    <Glyph
      // 1.5px on a 24px grid, whatever the rendered size.
      strokeWidth={1.5}
      aria-hidden="true"
      className={cn(
        SIZES[size] ?? SIZES[20],
        muted ? "text-[var(--gray)]" : "text-[var(--charcoal)]",
        className,
      )}
      {...props}
    />
  );
}
