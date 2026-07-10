import { Router, Request, Response } from "express";
import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DocumentModel } from "./documents";
import { NoteModel } from "./notes";
import { validateJwt, requireMultiTenancy } from "../middleware/auth";

const router = Router();
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

router.post("/chat", validateJwt, requireMultiTenancy, async (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query content is required." });
  }

  try {
    const lowercaseQuery = query.toLowerCase();
    const isAggregateQuery = 
      lowercaseQuery.includes("total") ||
      lowercaseQuery.includes("amount") ||
      lowercaseQuery.includes("sum") ||
      lowercaseQuery.includes("all files") ||
      lowercaseQuery.includes("all documents") ||
      lowercaseQuery.includes("summary") ||
      lowercaseQuery.includes("list of");

    const isFileRequest = 
      lowercaseQuery.includes("give me") ||
      lowercaseQuery.includes("show") ||
      lowercaseQuery.includes("download") ||
      lowercaseQuery.includes("get") ||
      lowercaseQuery.includes("file") ||
      lowercaseQuery.includes("document");

    let searchResults: any[] = [];

    // 1. Fetch relevant or all documents
    if (isAggregateQuery) {
      // Fetch all documents for aggregate analysis
      searchResults = await DocumentModel.find({ auth0UserId: req.auth0UserId }).sort({ createdAt: -1 });
    } else {
      // Generate Query Vector Embedding via AWS Titan Embeddings
      try {
        const titanPayload = {
          inputText: query,
        };

        const bedrockTitanCommand = new InvokeModelCommand({
          modelId: "amazon.titan-embed-text-v2:0",
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(titanPayload),
        });

        const titanResponse = await bedrockClient.send(bedrockTitanCommand);
        const titanResult = JSON.parse(new TextDecoder().decode(titanResponse.body));
        const queryVector = titanResult.embedding;

        // Query MongoDB Atlas using native $vectorSearch matching tenant criteria
        searchResults = await DocumentModel.aggregate([
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
      } catch (vectorSearchErr: any) {
        console.warn("Atlas Vector Search failed or is unconfigured for documents, falling back to loading latest documents:", vectorSearchErr.message);
        // Fallback: Retrieve the latest 5 documents for the user as context
        searchResults = await DocumentModel.find({
          auth0UserId: req.auth0UserId
        })
        .sort({ createdAt: -1 })
        .limit(5);
      }
    }

    // 2. Perform direct filename keyword match (always, to ensure accuracy)
    const allDocs = await DocumentModel.find({ auth0UserId: req.auth0UserId });
    const matchedDocs = allDocs.filter(doc => {
      const nameParts = doc.originalName.toLowerCase().split(/[\s._-]+/);
      return nameParts.some((part: string | any[]) => part.length > 2 && lowercaseQuery.includes(part));
    });
    const existingIds = new Set(searchResults.map((d: any) => d._id.toString()));
    for (const doc of matchedDocs) {
      if (!existingIds.has(doc._id.toString())) {
        searchResults.push(doc);
      }
    }

    // 3. Query notes using $vectorSearch or fallback
    let noteSearchResults = [];
    try {
      const titanPayload = {
        inputText: query,
      };

      const bedrockTitanCommand = new InvokeModelCommand({
        modelId: "amazon.titan-embed-text-v2:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(titanPayload),
      });

      const titanResponse = await bedrockClient.send(bedrockTitanCommand);
      const titanResult = JSON.parse(new TextDecoder().decode(titanResponse.body));
      const queryVector = titanResult.embedding;

      noteSearchResults = await NoteModel.aggregate([
        {
          $vectorSearch: {
            index: "notes_vector_index",
            path: "embedding",
            queryVector: queryVector,
            numCandidates: 10,
            limit: 3,
          },
        },
        {
          $match: {
            auth0UserId: req.auth0UserId,
          },
        },
      ]);
    } catch (vectorSearchErr: any) {
      console.warn("Atlas Vector Search failed or is unconfigured for notes, falling back to loading latest notes:", vectorSearchErr.message);
      // Fallback: Retrieve the latest 5 notes for the user as context
      noteSearchResults = await NoteModel.find({
        auth0UserId: req.auth0UserId
      })
      .sort({ updatedAt: -1 })
      .limit(5);
    }

    // Format matches as context for RAG prompt
    const docContextText = searchResults
      .map((doc: any) => `[Document ID: ${doc._id}, File: ${doc.originalName}, Category: ${doc.category}] OCR content: ${doc.rawOcrText}`)
      .join("\n\n");

    const noteContextText = noteSearchResults
      .map((note: any) => `[Note Title: ${note.title}] Content: ${note.rawText}`)
      .join("\n\n");

    const contextText = [docContextText, noteContextText].filter(Boolean).join("\n\n");

    // 4. Prompt Bedrock Claude to synthesize a highly accessible, clear, direct response
    const promptMessage = `
You are the voice assistant for the Family Vault digital locker.
Your user is an elderly family member. Keep sentences simple, friendly, large-font readable, and highly precise.
Provide a conversational, easy-to-understand answer based on the secure context documents and notes provided below.
If the user asks for calculations (like total amount, sum, count) or a summary, compute it accurately using the information in the documents.

If the user is asking to show, retrieve, or download a specific file (e.g., "give me the file", "show the document", "return only files", "give me this only files"), do not explain or summarize the document content. Instead, respond ONLY with a short message: "This is your requested document:" and let the system attach the download link. Do not write any other text.

[Context Documents and Notes]:
${contextText || "No matching secure documents or notes found."}

[User Query]:
${query}

Answer:
`;

    const converseCommand = new ConverseCommand({
      modelId: "amazon.nova-micro-v1:0",
      messages: [
        {
          role: "user",
          content: [{ text: promptMessage }]
        }
      ],
      inferenceConfig: {
        maxTokens: 500,
        temperature: 0.7
      }
    });

    const converseResponse = await bedrockClient.send(converseCommand);
    const assistantAnswer = converseResponse.output?.message?.content?.[0]?.text || "";

    return res.status(200).json({
      answer: assistantAnswer,
      sources: [
        ...searchResults.map((d: any) => ({
          originalName: d.originalName,
          category: d.category,
          id: d._id,
          type: "document"
        })),
        ...noteSearchResults.map((n: any) => ({
          originalName: n.title,
          category: "Note",
          id: n._id,
          type: "note"
        }))
      ]
    });
  } catch (err: any) {
    console.error("AI Assistant error:", err);
    return res.status(200).json({
      answer: `I had trouble connecting to the AI helper (Error: ${err.message || err}). Please check your AWS settings.`,
      sources: []
    });
  }
});

export default router;
