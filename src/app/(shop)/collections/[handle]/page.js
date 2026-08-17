import { notFound } from "next/navigation";
import { getCollection } from "@/lib/collection";
import CollectionPage from "./CollectionPage";

/**
 * The collection page (PLP).
 *
 * Renders on the server, filters and all: the sort and every facet live in the URL, so a filtered
 * page arrives as HTML, is shareable, and survives a reload. The browser fetches exactly one thing
 * -- the next page of products when the shopper scrolls.
 *
 * The jewelry build's equivalent renders an empty shell and then makes, per view: a filters call, a
 * products call that has to wait for it, a metadata call, a "true minimum price" call, and two
 * calls PER CARD for pricing and reviews. None of that exists here.
 */
export const revalidate = 86400;

/** The card image sits high on the page, so the first row is worth loading eagerly. */
const PRIORITY_CARDS = 4;

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const collection = await getCollection({ handle, first: 1 });
  if (!collection) return {};

  const description = collection.seo?.description || collection.description.slice(0, 160);

  return {
    title: collection.seo?.title || `${collection.title} | Material`,
    description,
    alternates: { canonical: `/collections/${handle}` },
    openGraph: {
      title: collection.seo?.title || collection.title,
      description,
      images: collection.image ? [collection.image.url] : [],
    },
  };
}

export default async function Page({ params, searchParams }) {
  const { handle } = await params;
  const search = new URLSearchParams(await searchParams).toString();

  const collection = await getCollection({ handle, search });
  if (!collection) notFound();

  return (
    <CollectionPage
      handle={handle}
      title={collection.title}
      sort={collection.sort}
      products={collection.products}
      facets={collection.facets}
      pageInfo={collection.pageInfo}
      totalCount={collection.totalCount}
      priorityCards={PRIORITY_CARDS}
    />
  );
}
