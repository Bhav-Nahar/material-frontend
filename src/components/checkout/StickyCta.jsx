"use client";

/**
 * The checkout's main action, pinned to the bottom of a phone screen and left exactly where it was
 * on a desktop one.
 *
 * WHY. All three checkout pages put their button at the END of a long column -- under a coupon
 * field, under an address form, under an order summary. On a 360px screen that is two or three
 * scrolls below the fold, so the one thing the page exists for is the one thing not on it. The
 * summary card is already `lg:sticky` for the same reason on a wide screen; this is the narrow-screen
 * half of that idea.
 *
 * HOW. Fixed and full-width below `lg`, plain flow above it -- one component, no duplicated button,
 * no second copy of the label to keep in sync.
 *
 * NO SPACER HERE. The first version left an in-flow div the height of the bar, which sounds right
 * and is not: this component is rendered INSIDE the summary card, so the spacer opened a 76px hole
 * in the middle of the card and still left the rows below it under the bar. The gap belongs to the
 * page, not to the button -- each checkout page carries `max-lg:pb-28` on its own container.
 */
export default function StickyCta({ children, note }) {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-2px_16px_rgba(28,27,25,0.08)] lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        {children}
        {note && <div className="lg:hidden">{note}</div>}
      </div>
    </>
  );
}
