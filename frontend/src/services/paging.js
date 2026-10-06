export const DEFAULT_PAGE_SIZE = 24;

/** Builds the `?page=&pageSize=` the paged list endpoints expect. */
export function pageQuery({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  return `page=${page}&pageSize=${pageSize}`;
}

/**
 * Walks every page of a paged endpoint. Exports and reports need the whole set,
 * and the alternative is an endpoint with no ceiling on it.
 */
export async function fetchAllPages(fetchPage, { pageSize = 200, maxPages = 100 } = {}) {
  const items = [];

  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchPage({ page, pageSize });
    items.push(...(result?.items ?? []));
    if (!result?.hasMore) break;
  }

  return items;
}
