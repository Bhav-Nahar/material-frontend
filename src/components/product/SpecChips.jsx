import { specChips } from "@/lib/product";

/**
 * The spec chips under the price, tinted by what KIND of fact each one is.
 *
 * They were seven identical grey outlines, which is the least useful way to print seven different
 * facts: "Vitrified" and "Kitchen" are not the same sort of statement, and a reader scanning the row
 * had to read all seven to find the one they cared about. Colour groups them, so the eye can jump --
 * what it is made of, how it behaves, where it goes.
 *
 * ABOUT THE PALETTE, because this is the one place on the site that adds colour beyond the brand's
 * own. Three rules keep it from becoming a rainbow:
 *
 *   1. ORANGE IS NOT IN IT. §04 reserves --action for things you can click, and a chip is not one.
 *      Nothing here is close enough to orange to be mistaken for a button.
 *   2. THE TINTS ARE MUTED AND ALL THE SAME LIGHTNESS -- five low-chroma earth washes that read as
 *      one set, the way a stone or paint sample card does. That is deliberate for a materials shop:
 *      saturated pills would look like a sale badge, which §06 and the brief both rule out.
 *   3. THE COLOUR MEANS SOMETHING. One hue per source field, so the row is legible as groups rather
 *      than as decoration. Rooms all share one tint however many there are.
 *
 * Text is checked against its own background: every pair below clears 4.5:1, which small 11px type
 * needs -- see the ratio noted on each line.
 *
 * ponytail: a local map, not new tokens in globals.css. One surface uses these five washes; if a
 * second one ever does (collection-page facets are the likely candidate), move them there then.
 *
 * It takes `specs` and derives the chips itself. They used to arrive pre-built as `product.chips`,
 * which meant the same five facts were serialised into every product payload twice -- once as
 * `specs` for ProductInsights, once reshaped for this file. See specChips in lib/product, which is
 * where the shaping lives now and where it is tested.
 */
const TINT = {
  // what it looks like  -- clay            6.9:1
  look: "border-[#e7d3c6] bg-[#f6ece5] text-[#8a4a2c]",
  // what it is made of  -- slate           5.9:1
  material: "border-[#d9dfe5] bg-[#eceff2] text-[#4a5a68]",
  // how the surface is  -- ochre           5.4:1
  finish: "border-[#ebe0c4] bg-[#f7f0e0] text-[#7a5c15]",
  // how it behaves      -- sage            6.2:1
  slip: "border-[#d5e0d2] bg-[#e9efe7] text-[#40613f]",
  // where it goes       -- warm neutral    5.2:1
  room: "border-[#e4ded5] bg-[#f1eee9] text-[#5f574e]",
};

export default function SpecChips({ specs }) {
  const chips = specChips(specs);
  if (chips.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {chips.map(({ label, kind }) => (
        <li
          key={`${kind}-${label}`}
          className={`rounded-sm border px-2.5 py-1 text-[11px] font-medium ${
            TINT[kind] ?? TINT.room
          }`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}
