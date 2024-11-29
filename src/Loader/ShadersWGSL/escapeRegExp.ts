/**
 * Escape special characters in a string to be used in a regular expression
 * @param str string to escape
 * @returns escaped string
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
