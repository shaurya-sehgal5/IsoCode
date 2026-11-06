import { GoogleGenAI } from "@google/genai";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function suggestColumnMapping(
  headers: string[],
  sampleRows: Record<string, unknown>[]
) {
  if (!ai) throw new Error("Gemini API key is not configured.");

  const response = await ai.models.generateContent({
    model,
    contents: `Map settlement file columns to these fields:
orderReference, transactionId, grossAmount, fees, netAmount, paymentDate, status.

Only use exact column names from the supplied headers.
Use null when uncertain. Never invent columns.
Do not use customer names, phone numbers or addresses.

Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows.slice(0, 5))}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          mapping: {
            type: "object",
            properties: {
              orderReference: { type: ["string", "null"] },
              transactionId: { type: ["string", "null"] },
              grossAmount: { type: ["string", "null"] },
              fees: { type: ["string", "null"] },
              netAmount: { type: ["string", "null"] },
              paymentDate: { type: ["string", "null"] },
              status: { type: ["string", "null"] }
            },
            required: [
              "orderReference", "transactionId", "grossAmount",
              "fees", "netAmount", "paymentDate", "status"
            ]
          },
          confidence: { type: "number" },
          explanation: { type: "string" }
        },
        required: ["mapping", "confidence", "explanation"]
      }
    }
  });

  if (!response.text) throw new Error("Gemini returned an empty response.");

  const result = JSON.parse(response.text);

  for (const field of Object.keys(result.mapping)) {
    const selected = result.mapping[field];
    if (selected !== null && !headers.includes(selected)) {
      result.mapping[field] = null;
    }
  }

  result.confidence = Math.max(0, Math.min(1, Number(result.confidence) || 0));
  return result;
}
