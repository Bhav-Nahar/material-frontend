/**
 * Window events used to talk between two client trees that do not share a parent -- the header,
 * mounted from layout.js, and whatever page is rendered below it.
 *
 * A named constant rather than a literal in two files: a typo in one of them fails silently, which
 * is the worst way for a button to do nothing.
 */
export const OPEN_MOBILE_MENU = "material:open-mobile-menu";
