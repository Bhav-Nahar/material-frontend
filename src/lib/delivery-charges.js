/**
 * What it costs to get the material off the van and into the room.
 *
 * TWO OPTIONS, which is the model Material Depot uses and the one this trade actually runs on:
 *
 *   Ground floor — the crew unloads at the building entrance and leaves it there. Free. The
 *                  customer's own labour carries it up, which for a contractor with a site team is
 *                  what they wanted anyway.
 *   Doorstep     — carried to the door. Priced, because it is real labour, and the price depends on
 *                  weight, how many floors, and whether there is a lift.
 *
 * WHY IT IS PRICED AT ALL. A 900 kg tile order to a fourth floor with no lift is four men for two
 * hours. Shopify's hosted checkout cannot ask the questions that price it, which is the whole reason
 * this store owns its checkout.
 *
 * ponytail: PLACEHOLDER RATES. These are shaped correctly -- per 100 kg, multiplied by floors, with
 * a discount when a lift does the lifting -- but the numbers are invented and must be replaced with
 * the real ones before launch. They live here, in one table, so that is a one-file change. Move them
 * to the backend the day they need to vary by pincode; the `pincodes` collection is already waiting.
 */
export const DELIVERY_OPTIONS = {
  ground: {
    id: "ground",
    label: "Ground floor",
    blurb: "Unloaded at the building entrance. You arrange the carry up.",
    free: true,
  },
  doorstep: {
    id: "doorstep",
    label: "Doorstep",
    blurb: "Carried into your home or site by our crew.",
    free: false,
  },
};

// PLACEHOLDER — confirm with operations.
const RATE_PER_100KG_PER_FLOOR = 120; // no lift, per floor climbed
const RATE_PER_100KG_WITH_LIFT = 90; // flat, regardless of floor
const GROUND_FLOOR_HANDLING = 150; // per 100kg, even with no stairs
const MINIMUM_DOORSTEP_CHARGE = 300;

/**
 * @returns {{ amount: number, basis: string, needsConfirmation: boolean }}
 *
 * `needsConfirmation` is the honest half of this: if we do not know the floor or whether there is a
 * lift, we cannot price the job, and saying so beats inventing a number the crew then has to argue
 * about on the doorstep.
 */
export function unloadingCharge({ option, weightKg, floor, liftAvailable }) {
  if (option !== "doorstep") return { amount: 0, basis: "Unloaded at the entrance", needsConfirmation: false };

  const units = Math.max(1, Math.ceil(Number(weightKg || 0) / 100));

  if (floor === null || floor === undefined || floor === "") {
    return { amount: 0, basis: "Confirmed before dispatch", needsConfirmation: true };
  }

  const floorNum = Number(floor);
  if (floorNum === 0) {
    return {
      amount: Math.max(MINIMUM_DOORSTEP_CHARGE, units * GROUND_FLOOR_HANDLING),
      basis: `${weightKg} kg, ground floor`,
      needsConfirmation: false,
    };
  }

  // Above ground with no answer on the lift, the two prices differ by more than double — a guess
  // here is either an overcharge or a crew arriving without enough people.
  if (typeof liftAvailable !== "boolean") {
    return { amount: 0, basis: "Confirmed before dispatch", needsConfirmation: true };
  }

  const amount = liftAvailable
    ? units * RATE_PER_100KG_WITH_LIFT
    : units * RATE_PER_100KG_PER_FLOOR * floorNum;

  return {
    amount: Math.max(MINIMUM_DOORSTEP_CHARGE, Math.round(amount)),
    basis: liftAvailable
      ? `${weightKg} kg, floor ${floorNum}, by lift`
      : `${weightKg} kg, ${floorNum} ${floorNum === 1 ? "flight" : "flights"} by stair`,
    needsConfirmation: false,
  };
}

// 18% on tiles, laminates and most building materials. Shown as a line the customer can see rather
// than folded silently into the price.
export const GST_RATE = 0.18;
