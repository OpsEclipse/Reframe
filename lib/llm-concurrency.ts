import { envInt } from "@/lib/retry";
import { Semaphore } from "@/lib/semaphore";

let openaiSem: Semaphore | null = null;
let groqSem: Semaphore | null = null;

export function getOpenAISemaphore(): Semaphore {
  if (!openaiSem) {
    openaiSem = new Semaphore(Math.max(1, envInt("OPENAI_MAX_CONCURRENCY", 4)));
  }
  return openaiSem;
}

export function getGroqSemaphore(): Semaphore {
  if (!groqSem) {
    groqSem = new Semaphore(Math.max(1, envInt("GROQ_MAX_CONCURRENCY", 4)));
  }
  return groqSem;
}

