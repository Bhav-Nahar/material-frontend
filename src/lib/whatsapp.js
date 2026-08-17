/**
 * A wa.me link with the message already typed into it.
 *
 * wa.me is WhatsApp's own click-to-chat endpoint -- no API, no key, no backend. The link opens the
 * customer's WhatsApp with `text` sitting in the compose box; THEY press send. Nothing is sent on
 * their behalf, which is the whole reason this is a link rather than a form post.
 *
 * `lines` is a list because the answers are a list, and an unanswered question drops out rather
 * than arriving as "Notes: undefined" -- falsy entries are removed before joining.
 */
export function buildWhatsappLink(number, lines) {
  const text = lines.filter(Boolean).join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
