import * as fs from 'fs';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

async function processIngestion() {
  console.log("Reading raw knowledge file...");
  
  // Read document content manually using native FS to keep things fast and transparent
  const rawContent = fs.readFileSync("company_policy.txt", "utf-8");

  // Initialize the recursive splitter engine
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 150,    // Hard target limit of characters per chunk
    chunkOverlap: 30,  // Characters shared between back-to-back chunks to preserve context flow
  });

  console.log("Analyzing text layout and creating chunks...");
  
  // Slice the text string down into an array of string pieces
  const chunks = await splitter.splitText(rawContent);

  console.log(`\nSuccess! Generated ${chunks.length} distinct chunks.\n`);
  
  // Examine exactly how the layout engine separated your text strings
  chunks.forEach((chunk, index) => {
    console.log(`=================================`);
    console.log(`CHUNK #${index + 1} (${chunk.length} chars)`);
    console.log(`=================================`);
    console.log(`"${chunk}"`);
    console.log(`\n`);
  });
}

processIngestion().catch((err) => {
  console.error("Critical error during document ingestion mapping:", err);
});