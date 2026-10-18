import Image from "next/image";
import {
  Bath,
  BadgeCheck,
  Bed,
  Briefcase,
  Bug,
  Building2,
  Check,
  CookingPot,
  DoorClosed,
  Droplets,
  Feather,
  Flame,
  House,
  Info,
  Leaf,
  LayoutGrid,
  MoveVertical,
  ShieldCheck,
  Sofa,
  Sparkles,
  Sun,
  Trees,
  Tv,
  UtensilsCrossed,
  Waves,
  Wrench,
} from "lucide-react";
import { specRows } from "@/lib/product";

/**
 * Product insights -- the ONE place the page states what this material is. Everything that used to
 * be said two or three times (chips, insight cards, an identifier strip, a Specifications panel)
 * is said here once.
 *
 * ORGANISED BY THE BUYER'S QUESTIONS, not by field. Material Depot (2026-10-18) lays the same facts
 * out as a row of identical tiles behind an "Overview" tab -- a data sheet the shopper has to read
 * left to right to find the one thing they came for. Someone choosing a wall finish is asking three
 * things, in this order, so the facts are grouped under them:
 *
 *   Highlights        why this one -- the 3-4 features the catalogue team wrote, with icons
 *   How it looks      Colour (its own photo), Look, Finish, Material
 *   Will it fit       Size, Thickness, Coverage (with the ₹/sq ft it works out to), Flexibility
 *   Where it works    the rooms, each with an icon
 *   Good to know      the caveat, as a callout, so it is read BEFORE an order rather than after
 *
 * Nothing is behind a tab: installation, care and the description stay in ProductDetails' open
 * panels below, reachable by find-in-page. Every group drops out when its data is absent, and
 * nothing here is a claim the merchant did not enter.
 */

// Feature label -> icon. Keyword match, first hit wins, a tick otherwise -- the same rule the
// admin's features image uses, so the page and the image agree.
const FEATURE_ICONS = [
  [/uv|sun|yellow|fade/i, Sun],
  [/water|moist|damp|wet/i, Droplets],
  [/fire|flame|heat/i, Flame],
  [/warrant|guarant|year/i, BadgeCheck],
  [/light|weight/i, Feather],
  [/durab|strong|strength|impact|tough|rust|corros/i, ShieldCheck],
  [/scratch|stain|clean|maint/i, Sparkles],
  [/termite|borer|insect|bug/i, Bug],
  [/install|easy|fit|diy/i, Wrench],
  [/vertical|horizontal/i, MoveVertical],
  [/flex|bend/i, Waves],
  [/eco|environment|green|recycl/i, Leaf],
];
const featureIcon = (label) => FEATURE_ICONS.find(([re]) => re.test(label))?.[1] ?? Check;

const ROOM_ICONS = [
  [/bed/i, Bed],
  [/bath|wash/i, Bath],
  [/kitchen|countertop/i, CookingPot],
  [/living|lounge/i, Sofa],
  [/office|study/i, Briefcase],
  [/hotel|commercial/i, Building2],
  [/restaurant|cafe/i, UtensilsCrossed],
  [/tv/i, Tv],
  [/wardrobe|cabinet|shutter|furniture/i, DoorClosed],
  [/outdoor|balcony|garden|exterior/i, Trees],
  [/wall|panel|ceiling|cladding|floor/i, LayoutGrid],
];
const roomIcon = (room) => ROOM_ICONS.find(([re]) => re.test(room))?.[1] ?? House;

// Which question each spec row answers. specRows owns the rows and their order.
const LOOKS = new Set(["Colour", "Look", "Finish", "Material"]);
const FITS = new Set(["Size", "Thickness", "Coverage area", "Flexibility", "Slip rating"]);

function Group({ title, children }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-meta">{title}</h3>
      {children}
    </div>
  );
}

function Facts({ rows, variant }) {
  return (
    <dl className="mt-3 space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
          <dt className="text-subtle">{label}</dt>
          <dd className="num flex items-center gap-2 text-right font-medium text-ink">
            {label === "Colour" && variant.image && (
              <Image
                src={variant.image}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 self-center rounded-full object-cover ring-1 ring-line"
              />
            )}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function ProductInsights({ product, variant }) {
  const { features, application, importantNote } = product.specs;
  const rows = specRows(product, variant);
  const looks = rows.filter(([label]) => LOOKS.has(label));
  const fits = rows.filter(([label]) => FITS.has(label));
  const ids = [
    ["Product code", variant.sku],
    ["Brand", product.vendor],
    ["Collection", product.collection?.title],
  ].filter(([, v]) => v);

  if (!features.length && !rows.length && !application.length && !importantNote.length) return null;

  return (
    <section aria-labelledby="product-insights" className="container-main mt-6 lg:mt-8">
      <h2 id="product-insights" className="font-display text-lg tracking-[-0.02em] lg:text-xl">
        Product insights
      </h2>

      {features.length > 0 && (
        // auto-fit: three features fill the row, four fill it too -- a fixed 4-column grid left a hole.
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
          {features.map((label) => {
            const Icon = featureIcon(label);
            return (
              <li
                key={label}
                className="flex items-center gap-3 rounded-sm border border-line bg-surface px-3.5 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper">
                  <Icon size={17} strokeWidth={1.5} className="text-ink" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium leading-snug text-ink">{label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {(looks.length > 0 || fits.length > 0 || application.length > 0) && (
        <div className="mt-3 grid gap-2.5 md:grid-cols-3">
          {looks.length > 0 && (
            <Group title="How it looks">
              <Facts rows={looks} variant={variant} />
            </Group>
          )}
          {fits.length > 0 && (
            <Group title="Will it fit">
              <Facts rows={fits} variant={variant} />
              {/* The number a shopper comparing a sheet with a box of tiles actually needs. */}
              {variant.perSqFt > 0 && (
                <p className="num mt-3 border-t border-line pt-2.5 text-xs text-subtle">
                  Works out to <span className="font-medium text-ink">₹{Math.round(variant.perSqFt)}/sq ft</span>
                </p>
              )}
            </Group>
          )}
          {application.length > 0 && (
            <Group title="Where it works">
              <ul className="mt-3 flex flex-wrap gap-2">
                {application.map((room) => {
                  const Icon = roomIcon(room);
                  return (
                    <li
                      key={room}
                      className="flex items-center gap-1.5 rounded-full bg-paper py-1 pl-2 pr-3 text-[13px] text-ink"
                    >
                      <Icon size={15} strokeWidth={1.5} className="text-subtle" aria-hidden="true" />
                      {room}
                    </li>
                  );
                })}
              </ul>
            </Group>
          )}
        </div>
      )}

      {/* The ochre wash SpecChips uses for finish (5.4:1 at 11px; darker text here for 14px body). */}
      {importantNote.length > 0 && (
        <div className="mt-5 flex gap-3 rounded-sm border border-[#ebe0c4] bg-[#f7f0e0] px-4 py-3 text-sm text-[#5c4510]">
          <Info size={17} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Good to know</p>
            {importantNote.map((line) => (
              <p key={line} className="mt-0.5">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Which exact item this is -- looked FOR, not browsed, so one quiet line rather than a band. */}
      {ids.length > 0 && (
        <p className="num mt-4 text-xs text-subtle">
          {ids.map(([label, value], i) => (
            <span key={label}>
              {i > 0 && <span className="mx-2 text-line-strong">·</span>}
              {label}: <span className="text-ink">{value}</span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
