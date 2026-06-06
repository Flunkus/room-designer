/* ===== Spec parser service =====
   Extracts W/D/H (cm) + a name from messy pasted product text.

   Two implementations behind one `parseSpec` entry point:
   - ClaudeSpecParser: real Anthropic call (claude-haiku-4-5), enabled when
     VITE_ANTHROPIC_API_KEY is set. (Browser key = LOCAL DEV ONLY.)
   - RegexSpecParser: dependency-free fallback (ported from prototype furniture.jsx).

   Swap in another LLM later by implementing SpecParser. */

export interface ParsedSpec {
  w: number;
  d: number;
  h: number;
  name?: string;
}

export interface SpecParser {
  parse(text: string): Promise<ParsedSpec>;
}

/** Regex fallback — ported from the prototype's parseBlurb(). */
export const RegexSpecParser: SpecParser = {
  async parse(text: string): Promise<ParsedSpec> {
    const g = (re: RegExp): number | null => {
      const m = text.match(re);
      return m ? Math.round(parseFloat(m[1])) : null;
    };
    const w = g(/width[:\s]*([\d.]+)\s*cm/i) || g(/([\d.]+)\s*cm\s*\(?w/i);
    const d = g(/depth[:\s]*([\d.]+)\s*cm/i);
    const h = g(/height[:\s]*([\d.]+)\s*cm/i);
    const name = text.split(/[,.]/)[0]?.slice(0, 32) || "Parsed Object";
    return { w: w || 198, d: d || 99, h: h || 83, name };
  },
};

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

/** Real Claude-backed parser (env-gated). Uses the Messages API with a strict
    JSON instruction; falls back to regex on any failure. */
export const ClaudeSpecParser: SpecParser = {
  async parse(text: string): Promise<ParsedSpec> {
    if (!ANTHROPIC_KEY) return RegexSpecParser.parse(text);
    try {
      // Lazy-import so the SDK isn't bundled into the critical path when unused.
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY, dangerouslyAllowBrowser: true });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        system:
          "You extract furniture dimensions from messy product text. " +
          "Return ONLY a compact JSON object with numeric centimetre fields " +
          '{"w":number,"d":number,"h":number,"name":string}. ' +
          "w=width, d=depth, h=height. Convert any units to cm. " +
          "If a dimension is missing, estimate from the item type. No prose.",
        messages: [{ role: "user", content: text }],
      });
      const block = msg.content.find((b) => b.type === "text");
      const raw = block && "text" in block ? block.text : "";
      const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as Partial<ParsedSpec>;
      return {
        w: Math.round(Number(parsed.w) || 0) || 198,
        d: Math.round(Number(parsed.d) || 0) || 99,
        h: Math.round(Number(parsed.h) || 0) || 83,
        name: (parsed.name || "").toString().slice(0, 32) || undefined,
      };
    } catch (err) {
      console.warn("[specParser] Claude parse failed, using regex fallback:", err);
      return RegexSpecParser.parse(text);
    }
  },
};

/** Active parser: real Claude when a key is present, else regex. */
export const activeSpecParser: SpecParser = ANTHROPIC_KEY ? ClaudeSpecParser : RegexSpecParser;

export function parseSpec(text: string): Promise<ParsedSpec> {
  return activeSpecParser.parse(text);
}
