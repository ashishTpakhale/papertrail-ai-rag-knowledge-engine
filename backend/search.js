import * as fs from 'fs';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
// FIX: Using the explicit modern export location
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import dotenv from "dotenv";

dotenv.config();

async function runVectorStore() {
  console.log("Reading raw knowledge file...");
  const rawContent = fs.readFileSync("company_policy.txt", "utf-8");
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 150,
    chunkOverlap: 30,
  });
  
  // Create LangChain format Document objects from text strings
  const docs = await splitter.createDocuments([rawContent]);
  console.log(`Prepared ${docs.length} document objects for indexing.`);

  const embeddingsModel = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001", 
  });

  console.log("Vectorizing documents and inserting into the Vector Database...");
  
  // Initialize our store using the MemoryVectorStore class
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddingsModel);
  console.log("Vector Database indexing complete!\n");

  // Perform a Semantic Search query
  const userQuery = "What command should the SRE execute if there is a memory leak?";
  console.log(`Executing Semantic Search for query: "${userQuery}"`);

  // Fetch the top 2 closest matching blocks
  const searchResults = await vectorStore.similaritySearch(userQuery, 2);

  console.log("\n--- Top Search Results Found ---");
  searchResults.forEach((result, idx) => {
    console.log(`\nMatch #${idx + 1}:`);
    console.log(`Content: "${result.pageContent}"`);
    console.log(`Metadata:`, result.metadata);
  });
}

runVectorStore().catch(console.error);