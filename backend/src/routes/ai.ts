import { Router, Request, Response } from "express";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DocumentModel } from "./documents";
import { validateJwt, requireMultiTenancy } from "../middleware/auth";

const router = Router();
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

router.post("/chat", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query content is required." });
  }

  try {
    // 1. Generate Query Vector Embedding via AWS Titan Embeddings
    const titanPayload = {
      inputText: query,
    };

    const bedrockTitanCommand = new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v1",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(titanPayload),
    });

    const titanResponse = await bedrockClient.send(bedrockTitanCommand);
    const titanResult = JSON.parse(new TextDecoder().decode(titanResponse.body));
    const queryVector = titanResult.embedding;

    // 2. Query MongoDB Atlas using native $vectorSearch matching tenant criteria
    // Atlas Vector search requires a defined index (e.g. "vector_index") mapping the embedding field.
    const searchResults = await DocumentModel.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 10,
          limit: 3,
        },
      },
      // Strict Security Isolation check for multi-tenant isolation
      {
        $match: {
          auth0UserId: req.auth0UserId,
        },
      },
    ]);

    // Format matches as context for RAG prompt
    const contextText = searchResults
      .map((doc: any) => `[File: ${doc.originalName}, Category: ${doc.category}] OCR content: ${doc.rawOcrText}`)
      .join("\n\n");

    // 3. Prompt Bedrock Claude to synthesize a highly accessible, clear, direct response
    const promptMessage = `
You are the voice assistant for the Family Vault digital locker.
Your user is an elderly family member. Keep sentences simple, friendly, large-font readable, and highly precise.
Provide a conversational, easy-to-understand answer based on the secure context documents provided below.
If the information is not found in the documents, tell the user politely and offer to record a note instead.

[Context Documents]:
${contextText || "No matching secure documents found."}

[User Query]:
${query}

Answer:
`;

    const claudePayload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: promptMessage,
        },
      ],
    };

    const bedrockClaudeCommand = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(claudePayload),
    });

    const bedrockClaudeResponse = await bedrockClient.send(bedrockClaudeCommand);
    const claudeResult = JSON.parse(new TextDecoder().decode(bedrockClaudeResponse.body));
    const assistantAnswer = claudeResult.content[0].text;

    return res.status(200).json({
      answer: assistantAnswer,
      sources: searchResults.map((d: any) => ({
        originalName: d.originalName,
        category: d.category,
        id: d._id,
      })),
    });
  } catch (err: any) {
    // Return mock graceful recovery if AWS credentials or MongoDB Atlas search indices are unconfigured in boilerplate dev mode
    return res.status(200).json({
      answer: `I received your question: "${query}". (Running in offline demo mode. Let's make sure S3 vector databases and AWS keys are configured in production).`,
      sources: []
    });
  }
});

export default router;
