/**
 * Performs fuzzy matching between a string and a query.
 * Returns true if all characters in the query appear in the string in order.
 *
 * @param str - The string to search in
 * @param query - The search query
 * @returns true if the query matches the string
 */
export function fuzzyMatch(str: string, query: string): boolean {
  if (!query) return true;

  const lowerStr = str.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let queryIndex = 0;
  for (let i = 0; i < lowerStr.length && queryIndex < lowerQuery.length; i++) {
    if (lowerStr[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  return queryIndex === lowerQuery.length;
}
