import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

/** With no credentials configured the app serves scripted demo content instead of calling Claude. */
export const isDemoMode = () => !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;

let client: Anthropic | null = null;
export function getClient() {
  client ??= new Anthropic();
  return client;
}

// Server-side fallbacks: if a safety classifier declines a request, the API re-runs it
// on Anthropic's recommended fallback model within the same call.
const FALLBACK: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

type Effort = "low" | "medium" | "high";

/**
 * Streams Claude's reply as plain text chunks, suitable for returning directly from a route.
 */
export function streamText(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens?: number;
  effort?: Effort;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const stream = getClient().beta.messages.stream({
          model: MODEL,
          max_tokens: opts.maxTokens ?? 8000,
          system: opts.system,
          messages: opts.messages,
          output_config: { effort: opts.effort ?? "medium" },
          ...FALLBACK,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n[Sorry — this request couldn't be completed. Please rephrase and try again.]"));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Error: ${describeError(err)}]`));
      } finally {
        controller.close();
      }
    },
  });
}

/** Single request whose reply is constrained to the given JSON schema. */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  effort?: Effort;
}): Promise<T> {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      effort: opts.effort ?? "medium",
      format: { type: "json_schema", schema: opts.schema },
    },
    ...FALLBACK,
  });
  if (response.stop_reason === "refusal") throw new Error("The request was declined. Please rephrase and try again.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as T;
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now — please wait a moment and retry.";
  if (err instanceof Anthropic.APIError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function textStreamResponse(body: ReadableStream<Uint8Array> | string) {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Streams canned text word by word so demo mode feels like the real thing. */
export function fakeStream(text: string, delayMs = 18): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(/(\s+)/);
  return new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(encoder.encode(w));
        await new Promise((r) => setTimeout(r, delayMs));
      }
      controller.close();
    },
  });
}
