import { envInt } from "@/lib/retry";
import { RateGate } from "@/lib/rate-gate";
import { Semaphore } from "@/lib/semaphore";

let openaiSem: Semaphore | null = null;
let groqSem: Semaphore | null = null;
let openaiGate: RateGate | null = null;
let groqGate: RateGate | null = null;

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

export function getOpenAIRateGate(): RateGate {
  if (!openaiGate) {
    openaiGate = new RateGate(Math.max(0, envInt("OPENAI_MIN_INTERVAL_MS", 0)));
  }
  return openaiGate;
}

export function getGroqRateGate(): RateGate {
  if (!groqGate) {
    groqGate = new RateGate(Math.max(0, envInt("GROQ_MIN_INTERVAL_MS", 0)));
  }
  return groqGate;
}
