import { LayoutGrid, HardHat, Truck } from "lucide-react";

/**
 * The "why Material" strip under the hero. The jewelry build's FeatureBar equivalent, in Material's
 * system:
 * hairline rules instead of cards (§06), icons in ink rather than a brand tint, and no rotation.
 *
 * Labels sit on one line on desktop and break onto two on a phone, where 390px across three columns
 * is not enough for "Installation Support". The break is fixed rather than left to wrapping, so all
 * three columns stay the same height.
 *
 * ponytail: server component, no state, no carousel. Add a supporting line per promise when there
 * are real numbers to put in it.
 */
const PROMISES = [
  { icon: LayoutGrid, top: "Pinteresty", bottom: "Materials" },
  { icon: HardHat, top: "Installation", bottom: "Support" },
  { icon: Truck, top: "Doorstep", bottom: "Delivery" },
];

export default function WhyMaterial() {
  return (
    <section aria-label="Why Material" className="border-y border-line bg-surface">
      <div className="container-main">
        <ul className="grid grid-cols-3 divide-x divide-line">
          {PROMISES.map(({ icon: Icon, top, bottom }) => (
            <li
              key={top}
              className="flex flex-col items-center gap-2.5 px-2 py-5 text-center lg:flex-row lg:justify-center lg:gap-3 lg:py-6 lg:text-left"
            >
              <Icon size={22} strokeWidth={1.5} className="shrink-0 text-ink" aria-hidden="true" />
              <span className="text-xs font-medium leading-tight text-ink lg:whitespace-nowrap lg:text-sm">
                {top}
                {/* Two lines on a phone so all three columns match height; one line from 1024px up,
                    where there is room for it. */}
                <br className="lg:hidden" />{" "}
                {bottom}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
