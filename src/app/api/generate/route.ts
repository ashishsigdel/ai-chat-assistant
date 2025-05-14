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
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    const chat = model.startChat({
      history,
    });

    const stream = await chat.sendMessageStream(prompt);

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
