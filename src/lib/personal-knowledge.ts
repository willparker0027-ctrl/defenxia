/**
 * Personal knowledge — canned answers for personal questions.
 * Checked BEFORE calling the AI so these always answer correctly,
 * even offline or when the edge function is unreachable.
 */
export function getPersonalKnowledgeAnswer(message: string): string | null {
  const q = message.toLowerCase().trim();

  const asksTanuj =
    q.includes("tanuj") ||
    (q.includes("thakur") && (q.includes("who is") || q.includes("who's") || q.includes("kaun")));

  if (asksTanuj) {
    return "Tanuj Thakur is a friend of Sajjad, and they used to play Free Fire together every day.";
  }

  const asksDeveloper =
    (q.includes("who") || q.includes("kaun")) &&
    (q.includes("develop") || q.includes("made") || q.includes("created") || q.includes("built") || q.includes("banaya")) &&
    q.includes("defenxia");

  if (asksDeveloper) {
    return "Sajjad is the developer of DEFENXIA.";
  }

  return null;
}
