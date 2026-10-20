const KEY = 'lp.editTokens';

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export const editTokens = {
  get: (commentId: string): string | undefined => read()[commentId],
  set: (commentId: string, token: string) =>
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [commentId]: token })),
};
