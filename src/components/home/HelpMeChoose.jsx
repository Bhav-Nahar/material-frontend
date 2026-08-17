"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { WHATSAPP_NUMBER } from "@/data/footer";
import { buildWhatsappLink } from "@/lib/whatsapp";
import WhatsappIcon from "@/components/common/WhatsappIcon";

/**
 * "Confused what to select?" -- Wakefit's arrangement: a band that asks a couple of questions and
 * hands the answers to a human, for the shopper who has scrolled every shelf and still cannot
 * choose.
 *
 * Ours ends in WHATSAPP rather than in a product grid. Wakefit can answer "which mattress" from a
 * quiz because a mattress is a spec sheet -- firmness, size, budget -- and the catalogue is small.
 * Tiles are not: the answer depends on the room's light, what the neighbour did, what is in stock
 * this week, and how much the builder already ruined. A quiz that pretends to answer that gives a
 * confident wrong shortlist. A salesperson on WhatsApp gives a right one, and Indian tile buying
 * already happens on WhatsApp.
 *
 * ponytail: no quiz engine, no scoring, no lead table, no backend. wa.me is WhatsApp's own
 * click-to-chat link, so the "submit" is a URL. If lead capture is ever wanted, THAT is when a
 * backend earns its place -- not before.
 */
export default function HelpMeChoose() {
  const [open, setOpen] = useState(false);
  // Matches Tailwind's lg, same as CategorySheet -- false on the server and on first paint, which
  // is fine because the sheet starts closed either way.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // No number, no section: a "message us" band that opens a broken chat is worse than no band.
  if (!WHATSAPP_NUMBER) return null;

  function handleSubmit(event) {
    event.preventDefault();
    const answers = new FormData(event.currentTarget);

    const url = buildWhatsappLink(WHATSAPP_NUMBER, [
      "Hi Material, I need help choosing.",
      // Every question is `required`, so the browser has already refused to submit a blank one --
      // but buildWhatsappLink drops falsy lines anyway, so a question added without `required`
      // later cannot produce a "Style: undefined".
      ...QUESTIONS.map((question) => `${question.answer}: ${answers.get(question.name)}`),
    ]);

    // noopener because the opened tab is whatsapp.com, not ours.
    window.open(url, "_blank", "noopener");
    setOpen(false);
  }

  return (
    <>
      {/* A full-bleed CHARCOAL banner, and the only dark thing between the header and the footer.
          Everything around it is cream photo grids on cream ground; a bordered light band the same
          shade as the rest -- the first version of this -- read as one more shelf and slid past.
          The break in tone IS the alert. It costs no photograph, which is the other reason: there
          is no room photography, so a "banner" made of imagery would be a stock-photo lie.

          It sits MID-PAGE rather than last for the same reason Wakefit's does: flush against the
          footer, one charcoal block runs straight into another and both stop registering. */}
      <section aria-labelledby="help-me-choose" className="group relative bg-ink text-paper">
        <div className="container-main flex flex-col items-start gap-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-14">
          <div className="max-w-xl">
            <h2
              id="help-me-choose"
              className="font-display text-2xl leading-tight tracking-[-0.02em] lg:text-4xl"
            >
              Feeling a little lost?
            </h2>
            <p className="mt-3 text-sm text-paper/70 lg:text-base">
              Share a few details about your space and we’ll help you find the right materials.
            </p>
          </div>

          {/* A SPAN, not a button. The whole banner is the control (see below); a real button here
              would be a second tab stop that does the same thing, and nesting one inside the hit
              area is invalid anyway. It still looks and hovers like the button it reads as. */}
          <span className="inline-flex shrink-0 items-center gap-2.5 rounded-sm bg-action px-6 py-3.5 text-sm font-medium text-on-action transition-opacity group-hover:opacity-90 lg:px-7 lg:py-4 lg:text-base">
            <WhatsappIcon className="size-5" />
            Help me choose
          </span>
        </div>

        {/* The hit area, stretched over the whole banner. One element, so it is one tab stop with
            one accessible name -- the alternative (making the outer wrapper a <button>) would put a
            heading inside a button, which is invalid and reads badly to a screen reader. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Help me choose — tell us about your space"
          className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-action"
        />
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          aria-describedby={undefined}
          // Same as CategorySheet: the built-in close has no z-index and the sticky header paints
          // over it, so ours lives IN the header.
          showCloseButton={false}
          className="gap-0 rounded-none p-0 sm:max-w-none lg:w-[30rem]"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-background px-5 py-4">
            <SheetTitle className="font-display text-lg tracking-[-0.02em] lg:text-xl">
              Help me choose
            </SheetTitle>
            <SheetClose
              aria-label="Close"
              className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-subtle hover:text-ink"
            >
              <X size={18} strokeWidth={1.5} />
            </SheetClose>
          </div>

          {/* A plain form read with FormData on submit. No state per field, no form library -- two
              questions do not need either, and the browser already validates and remembers them. */}
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[80vh] flex-col gap-7 overflow-y-auto px-5 py-6 lg:max-h-none lg:flex-1"
          >
            {QUESTIONS.map((question) => (
              <fieldset key={question.name}>
                <legend className="mb-3 text-sm font-medium text-ink">{question.legend}</legend>
                {/* Native radios, visually hidden, styled through peer-checked -- the same chip the
                    room picker uses. Keyboard and screen readers get a real radio group for free,
                    and `required` gets the browser to enforce an answer with no validation code. */}
                <div className="flex flex-wrap gap-2">
                  {question.options.map((option) => (
                    <label key={option} className="cursor-pointer">
                      <input
                        type="radio"
                        name={question.name}
                        value={option}
                        required
                        className="peer sr-only"
                      />
                      <span className="block rounded-sm border border-line px-3.5 py-2 text-sm text-ink transition-colors hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:font-medium peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-action peer-focus-visible:ring-offset-2">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div>
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-sm bg-action px-5 py-3 text-sm font-medium text-on-action transition-opacity hover:opacity-90"
              >
                <WhatsappIcon className="size-[18px]" />
                Send on WhatsApp
              </button>
              {/* Said plainly because the button names another app: nothing leaves until they
                  press send inside WhatsApp. */}
              <p className="mt-3 text-xs leading-relaxed text-subtle">
                Opens WhatsApp with your answers filled in. Nothing is sent until you press send
                there.
              </p>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Three taps, no typing. A free-text box was the first version and it was the wrong ask: the person
 * who opens this banner is the one who does not know what to say, and an empty box asks them to
 * write the brief they came here without.
 *
 * Every question ends in an escape hatch -- "Other", "Not sure" -- because forcing a confident
 * answer out of someone who is here BECAUSE they are unsure produces a confident wrong one, and the
 * salesperson reading this on WhatsApp would rather see "Not sure" than a guess.
 *
 * Sentence case, not Title Case, to match the room chips and the rest of the site.
 *
 * `answer` is the label that goes into the WhatsApp message -- shorter than the question, because
 * the message is read on a phone in a chat list.
 */
const QUESTIONS = [
  {
    name: "project",
    legend: "What are you working on?",
    answer: "Working on",
    options: ["Home", "Office", "Retail / Commercial", "Other"],
  },
  {
    name: "space",
    legend: "What space are you designing?",
    answer: "Space",
    options: ["Living room", "Bedroom", "Kitchen", "Bathroom", "Other"],
  },
  {
    name: "style",
    legend: "What style are you looking for?",
    answer: "Style",
    options: ["Minimal & modern", "Warm & natural", "Bold & dramatic", "Classic & elegant", "Not sure"],
  },
];

/**
 * WhatsApp's own mark. lucide-react carries no brand icons (they were dropped upstream, on purpose
 * -- trademarks are not an icon set), so a button that says WhatsApp has to bring the glyph itself.
 *
 * ponytail: one path, inline. No icon package for a single logo, and inlining means it is already
 * on screen when the banner paints rather than one request later.
 *
 * currentColor, so it inherits text-on-action on the CTA and needs no colour of its own.
 */
