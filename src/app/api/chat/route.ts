import {
   LangChainAdapter,
   Message as VercelChatMessage,
   StreamingTextResponse,
} from "ai";
import { auth } from "@/auth";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
   const session = await auth();
   const token = session?.user?.idToken

   const {
      messages,
      name,
      model,
      region,
   }: {
      messages: VercelChatMessage[];
      name: string;
      model: string;
      region: string;
   } = await req.json();
   const selectedModel = model || 'llama3';
   const chat_history = messages.slice(-10); // Better continuity
   const template = `You are Sofya, a friendly English Companion. Help users improve English through casual, friendly conversation. 😊 Respond in casual English, be friendly and enthusiastic, use emoticons, ask at most one or two follow-up questions per response, use light humor, conclude with friendly closings. Avoid repetition, express interest in user's input, use names sparingly, don't correct errors. If user writes in another language, gently remind to use English. The user's name is ${name}.`

   const ollamaApiUrl =
      process.env.MODE === "development"
         ? "http://localhost:11434/api/chat"
         : `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/${region}/api/chat`;

   console.log(`[Chat] Model: ${selectedModel} | Region: ${region} | Context: ${chat_history.length}`);

   const response = await fetch(ollamaApiUrl, {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
         model: selectedModel,
         messages: [
            { role: "system", content: template },
            ...chat_history,
         ],
         stream: false, // Stable for Non-Proxy Gateway
      }),
   });

   if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Chat] Error ${response.status}:`, errorText);
      throw new Error(`Ollama API error: ${response.status}`);
   }

   const data = await response.json();
   const content = data.message?.content || "";

   if (!content) {
      console.warn("[Chat] AI returned empty content");
   }

   const stream = new ReadableStream({
      start(controller) {
         controller.enqueue(content);
         controller.close();
      },
   });

   const aiStream = LangChainAdapter.toAIStream(stream);

   return new StreamingTextResponse(aiStream);
}