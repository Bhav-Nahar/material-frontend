"use client";

import { useState, useEffect } from "react";

export function useMediaQuery(query) {
  // False on the server and on the first client render, so SSR markup and hydration agree.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (e) => setMatches(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
