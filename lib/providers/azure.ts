/**
 * Azure AI Foundry / Azure OpenAI provider for the "Without Trapdoor" demo
 * side. We use the new Responses API (OpenAI-compatible). Auth via api-key
 * header (Foundry) with Authorization Bearer as a fallback.
 *
 * Env required:
 *   AZURE_OPENAI_ENDPOINT  — full URL to the /responses (or /chat/completions) endpoint
 *   AZURE_OPENAI_KEY       — access key
 *   AZURE_OPENAI_MODEL     — deployment / model name (e.g. gpt-4o-mini)
 */

export function azureConfigured(): boolean {
  return !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY);
}

export interface AzureCallArgs {
  prompt: string;
  imageBase64?: string;
}

interface AzureResult {
  response: string;
  latencyMs: number;
  modelLabel: string;
  errored: boolean;
}

function endpointIsResponsesApi(url: string): boolean {
  return /\/responses(\?|$)/.test(url) || url.endsWith("/responses");
}

export async function callAzure(args: AzureCallArgs): Promise<AzureResult> {
  const start = Date.now();
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const key = process.env.AZURE_OPENAI_KEY!;
  const model = process.env.AZURE_OPENAI_MODEL || "gpt-4o-mini";

  // Build the multimodal content block.
  const contentParts: any[] = [];
  if (args.imageBase64) {
    contentParts.push({
      type: "input_image",
      image_url: args.imageBase64,
    });
  }
  contentParts.push({ type: "input_text", text: args.prompt });

  const isResponsesApi = endpointIsResponsesApi(endpoint);

  const body = isResponsesApi
    ? {
        model,
        input: [{ role: "user", content: contentParts }],
        max_output_tokens: 700,
      }
    : {
        model,
        messages: [
          {
            role: "user",
            content: args.imageBase64
              ? [
                  { type: "image_url", image_url: { url: args.imageBase64 } },
                  { type: "text", text: args.prompt },
                ]
              : args.prompt,
          },
        ],
        max_tokens: 700,
      };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": key,
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        response: `[Azure error ${res.status}] ${text.slice(0, 400)}`,
        latencyMs: Date.now() - start,
        modelLabel: `azure · ${model}`,
        errored: true,
      };
    }

    const data: any = await res.json();
    // Responses API shape
    let text = "";
    if (data.output && Array.isArray(data.output)) {
      for (const o of data.output) {
        if (o.content && Array.isArray(o.content)) {
          for (const c of o.content) {
            if (typeof c.text === "string") text += c.text;
            else if (typeof c?.text?.value === "string") text += c.text.value;
          }
        }
      }
    }
    // Chat completions shape
    if (!text && data.choices?.[0]?.message?.content) {
      const c = data.choices[0].message.content;
      text = typeof c === "string" ? c : Array.isArray(c) ? c.map((p: any) => p.text || "").join("") : "";
    }
    // output_text helper (Responses API convenience)
    if (!text && typeof data.output_text === "string") text = data.output_text;

    return {
      response: text || "[Azure: empty response]",
      latencyMs: Date.now() - start,
      modelLabel: `azure · ${model}`,
      errored: false,
    };
  } catch (e: any) {
    return {
      response: `[Azure fetch error] ${e?.message || String(e)}`,
      latencyMs: Date.now() - start,
      modelLabel: `azure · ${model}`,
      errored: true,
    };
  }
}
