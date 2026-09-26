/** The best winning word count determines stars, regardless of attempt count. */
export const winStars = (words: number) => words === 1 ? 3 : words === 2 ? 2 : 1
