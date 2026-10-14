import OpenAI from "openai";
import { buildGroundedFallback, getOpenAIMessages } from "@/lib/knowledge-base";
import type { ChatMessage } from "@/lib/validation";

export type AnswerResult = { answer: string; status: "success" | "fallback" };

export async function generateAnswer(messages: ChatMessage[]): Promise<AnswerResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { answer: buildGroundedFallback(messages), status: "fallback" };
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
      timeout: 15_000,
      maxRetries: 1
    });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: getOpenAIMessages(messages),
      temperature: 0.1,
      // Free reasoning models may need extra tokens before producing their final answer.
      max_tokens: 900
    });
    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) throw new Error("Empty model response");
    return { answer: answer.slice(0, 4000), status: "success" };
  } catch {
    return { answer: buildGroundedFallback(messages), status: "fallback" };
  }
}
