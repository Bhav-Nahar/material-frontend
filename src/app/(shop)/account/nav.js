import { Heart, MapPin, Package, Ticket, User } from "lucide-react";

/**
 * One list, used by the hub cards, the desktop rail and the mobile back link. Three places that must
 * agree on what the account contains -- if they drift, a section becomes unreachable from one of them
 * and nobody notices until a customer says they cannot find their orders.
 */
export const ACCOUNT_SECTIONS = [
  {
    href: "/account/profile",
    label: "My profile",
    hint: "Name, email and how you sign in",
    icon: User,
  },
  {
    href: "/account/orders",
    label: "My orders",
    hint: "Track deliveries and see what you've bought",
    icon: Package,
  },
  {
    href: "/account/coupons",
    label: "My coupons",
    hint: "Discounts you've won and can still use",
    icon: Ticket,
  },
  {
    href: "/account/wishlist",
    label: "Saved items",
    hint: "Materials you're still deciding on",
    icon: Heart,
  },
  {
    href: "/account/addresses",
    label: "My addresses",
    hint: "Where your materials get delivered",
    icon: MapPin,
  },
];
