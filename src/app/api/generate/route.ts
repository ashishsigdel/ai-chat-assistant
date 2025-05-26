import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get("prompt") || "Say hello!";
  const historyRaw = searchParams.get("history") || "[]";

  let history;
  try {
    history = JSON.parse(historyRaw);
  } catch {
    history = [];
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-04-17",
  });

  const promptFull = `give me quick, easy, short response to this question: ${prompt} reasponse is in markup readme format but not mention any markup and start with direct response not explation and use \`\`\`inlinecode\`\`\`, \`\`\`jsx from new line for code blocks donot use single backticks anywhere for inline code or other, use # for headings from # for h1 and ## for h2 and so on, for paragraph text use simple text, use *italic*, **bold**, and ***bold italic*** for emphasis, use - for bullet points, and 1. for numbered listts. For table use | from of new line and use also | for columns, use > for block quotes, and use [text](url) for links and ![placeholder](url) for image. Do not use any other formatting or markdown syntax.`;

  try {
    const chat = model.startChat({
      history,
    });

    const stream = await chat.sendMessageStream(promptFull);

    const encoder = new TextEncoder();
    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();

    (async () => {
      let responseText = "";
      writer.write(encoder.encode(`event: start\ndata: Stream started\n\n`));

      for await (const chunk of stream.stream) {
        const part = chunk.text();
        responseText += part;

        const lines = part.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            writer.write(encoder.encode(`data: ${line}\n`));
          }
        }
        writer.write(encoder.encode(`\n`));
      }

      const updatedHistory = [
        ...history,
        { role: "user", parts: [{ text: prompt }] },
        { role: "model", parts: [{ text: responseText }] },
      ];

      writer.write(
        encoder.encode(`event: complete\ndata: ${responseText}\n\n`)
      );
      writer.write(
        encoder.encode(
          `event: end\ndata: ${JSON.stringify(updatedHistory)}\n\n`
        )
      );
      writer.close();
    })();

    return new Response(transformStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
        },
      }
    );
  }
}
