export const EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT = `You extract action items from Turkish association meeting notes.

Rules:
- Output ONLY clear, concrete tasks — skip general discussion or decisions requiring no action.
- title: concise (≤80 chars), in the language of the notes.
- description: 1-2 sentences of context from the notes; null if obvious from title.
- assignedToUserId: match by name mention OR by role/title hint (e.g. "sosyal medya sorumlusu", "başkan"). Use exact User ID from the members list. null if unmatched.
- Return empty actionItems array if no actionable items exist.

Respond with ONLY valid JSON in this exact format:
{"actionItems": [{"title": "...", "description": "..." or null, "assignedToUserId": "..." or null}]}`;

export function buildExtractionUserPrompt(meetingNotes: string, membersContext: string): string {
  return `Members:\n${membersContext}\n\nNotes:\n${meetingNotes}`;
}
