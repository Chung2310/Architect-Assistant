import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// overriding fetch to see what payload is sent
const originalFetch = global.fetch;
global.fetch = async (url: any, options: any) => {
  console.log("PAYLOAD:", options?.body);
  return originalFetch(url, options);
};

async function main() {
  const prompt = `<role>\nYou are an Elite Architectural Competition Board Designer. Your task is to analyze the provided building image and deconstruct it into a highly technical, professional Landscape (16:9) Competition Layout Board.\n</role>\n\n<core_directives>\n1. STRICT SWISS GRID LAYOUT (MODULAR DESIGN): The board MUST be organized using a rigorous "Swiss Grid" system. Divide the landscape canvas into clean, strictly aligned rectangular columns and rows. There must be distinct margins and gutters. NO messy overlapping of elements. Every diagram and text block must sit perfectly inside its own invisible bounding box.\n\n2. THE HERO ELEMENT - VERTICAL EXPLODED AXONOMETRIC: The central and most prominent element (taking up at least 40% of the board) MUST be a highly detailed, hallucinated Vertical Exploded Axonometric diagram of the exact building in the reference image.\n- Lift the roof straight up.\n- Suspend the intermediate floor slabs and walls in mid-air.\n- Keep the foundation/ground floor at the bottom.\n- Connect these vertically exploded layers with crisp, dashed vertical drafting lines.\n\n3. SECONDARY GRID ELEMENTS: Fill the remaining grid boxes with the following hallucinated elements, all mathematically aligned:\n- "MAIN RENDER": A small but high-quality inset image of the original building perspective.\n- "MASSING EVOLUTION": A sequence of 3 small diagrams showing the volumetric process (box -> carved -> final form).\n- "SPATIAL SECTION": A clean, orthogonal architectural cross-section.\n- "CONTEXT MAP": A minimal, abstract site map.\n\n4. TYPOGRAPHY & TEXT BLOCKS: Use precise, minimalist sans-serif typography. \n- Above each grid element, place a crisp English heading (e.g., "EXPLODED AXONOMETRIC", "MASSING STRATEGY", "TRANSVERSAL SECTION").\n- Generate justified, structured blocks of realistic architectural text (e.g., describing structural integrity, programmatic distribution, and spatial flow) to fill the text-designated grid cells.\n\n5. UNIFIED STYLE OVERRIDE: The entire board, including the exploded diagram, sections, and the render inset, MUST be completely unified under this exact visual aesthetic:[Minimalist].\n</core_directives>\n\n<output_formatting>\nGenerate a single, ultra-high-resolution landscape board. Prioritize the alignment of the Swiss grid, the structural logic of the exploded view, and the overall professional competition-level aesthetic.\n</output_formatting>`;

  await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg=="
            }
          }
        ]
      }
    ],
    config: {
      temperature: 0.5,
      imageConfig: { aspectRatio: "16:9" } as any,
    }
  });
}
main();
