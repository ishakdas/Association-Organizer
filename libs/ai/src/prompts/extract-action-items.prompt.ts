export const EXTRACT_ACTION_ITEMS_SYSTEM_PROMPT = `You are an AI assistant that extracts action items from meeting notes.

Given meeting notes, identify all action items — tasks, follow-ups, decisions that require action.

For each action item, extract:
- content: A clear, concise description of what needs to be done
- assigneeName: The name of the person responsible (if mentioned), or null

Return a JSON object matching the required schema. Only include clear, actionable items — not general discussion points.`;

export function buildExtractionUserPrompt(meetingNotes: string): string {
  return `Extract action items from the following meeting notes:\n\n---\n${meetingNotes}\n---`;
}
