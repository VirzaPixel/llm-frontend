import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const session = await auth();
    const token = session?.user?.idToken;

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { text, model, region } = await req.json();

        if (!text || !model || !region) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const ollamaApiUrl =
            process.env.MODE === "development"
                ? "http://localhost:11434/api/embeddings"
                : `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/${region}/api/embeddings`;

        console.log(`[Embed] Calling: ${ollamaApiUrl} with model: ${model}`);

        const response = await fetch(ollamaApiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                model: model,
                prompt: text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Embed] API Error:", errorText);
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ embedding: data.embedding });
    } catch (error: any) {
        console.error("[Embed] Catch Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
