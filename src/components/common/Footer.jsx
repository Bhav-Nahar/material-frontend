import Link from "next/link";
import { Mail, MapPin, Phone, Instagram, Facebook, Youtube } from "lucide-react";
import { getArticles } from "@/lib/blog";
import { getMenu, transformMenuData } from "@/lib/menus";
import {
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  FOOTER_SOCIALS,
  FOOTER_TAGLINE,
} from "@/data/footer";
import Wordmark from "@/components/header/Wordmark";

/**
 * Site footer, from the jewelry build this project was adapted from, stripped back:
 *
 *   - SERVER component. Theirs is "use client" for two reasons, neither of which we have: a
 *     usePathname check to hide itself on three routes, and useMediaQuery to pick a tree.
 *   - ONE tree. Theirs renders a completely separate mobile version, so every link is written
 *     twice -- 381 lines, and a link added to one half silently missing from the other. Columns
 *     reflow 2-up to 4-up instead.
 *   - NO accordion. Theirs needs one because it carries 50+ links per column; ours are four and
 *     five deep, which fit open on a phone and cost no JavaScript.
 *   - The SHOP column is read from the header's own menu rather than hardcoded, so the two cannot
 *     drift apart.
 *   - Charcoal ground, not the accent. §04 keeps orange for actions; the wordmark is the documented
 *     exception (§02) and stays orange here.
 *
 * ponytail: no newsletter form, no store locator, no payment-method icon strip. Add the newsletter
 * when something is on the other end of it.
 */
const SOCIAL_ICONS = { Instagram, Facebook, YouTube: Youtube };

export default async function Footer() {
  const menu = transformMenuData(await getMenu());
  const shop = menu
    .filter((item) => item.href?.startsWith("/collections/"))
    .map((item) => ({ label: item.label, href: item.href }));

  // Guides appear in the footer only once one is published -- an empty column is dropped by the
  // filter below, same as the About column that pointed at pages nobody had written.
  // A day, not the blog's ten minutes: this runs on every route, and the shortest fetch on a page
  // sets that page's revalidate. A new link showing up within a day is fine; recutting the whole
  // site's cache to ten minutes to find that out is not.
  const guides = (await getArticles(1, 86400)).length ? [{ label: "Guides", href: "/blog" }] : [];

  const columns = [
    { title: "Shop", links: shop },
    ...FOOTER_COLUMNS,
    { title: "Read", links: guides },
  ].filter((c) => c.links.length > 0);

  const { email, phone, address } = FOOTER_CONTACT;
  const hasContact = email || phone || address;

  return (
    <footer className="bg-ink text-paper">
      <div className="container-main py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-14">
          <div>
            <Wordmark href="/" />
            <p className="mt-4 max-w-70 text-sm text-paper/70">{FOOTER_TAGLINE}</p>
          </div>

          {/* 2-up on a phone, 4-up from lg. The contact block is a column like any other. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-4 lg:gap-x-8">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-[11px] uppercase tracking-wide text-paper/50">{column.title}</h3>
                <ul className="mt-3.5 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        prefetch={false}
                        className="text-sm text-paper/90 underline-offset-4 hover:text-paper hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {hasContact && (
              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-paper/50">Contact</h3>
                <ul className="mt-3.5 space-y-2.5 text-sm text-paper/90">
                  {email && (
                    <li className="flex items-start gap-2.5">
                      <Mail size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-paper/50" />
                      <a href={`mailto:${email}`} className="break-all underline-offset-4 hover:underline">
                        {email}
                      </a>
                    </li>
                  )}
                  {phone && (
                    <li className="flex items-start gap-2.5">
                      <Phone size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-paper/50" />
                      {/* tel: strips spaces -- a dialler cannot parse them. */}
                      <a
                        href={`tel:${phone.replace(/\s/g, "")}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {phone}
                      </a>
                    </li>
                  )}
                  {address && (
                    <li className="flex items-start gap-2.5">
                      <MapPin size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-paper/50" />
                      <span>{address}</span>
                    </li>
                  )}
                </ul>

                {FOOTER_SOCIALS.length > 0 && (
                  <ul className="mt-5 flex items-center gap-4">
                    {FOOTER_SOCIALS.map((social) => {
                      const Icon = SOCIAL_ICONS[social.label];
                      return (
                        <li key={social.label}>
                          <a
                            href={social.href}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={social.label}
                            className="block text-paper/70 transition-colors hover:text-paper"
                          >
                            {Icon ? <Icon size={18} strokeWidth={1.5} /> : social.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-paper/15">
        <div className="container-main flex flex-col-reverse items-center justify-between gap-3 py-5 text-xs text-paper/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Texture House. All rights reserved.</p>
          <ul className="flex items-center gap-5">
            {FOOTER_LEGAL.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  prefetch={false}
                  className="underline-offset-4 hover:text-paper hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
