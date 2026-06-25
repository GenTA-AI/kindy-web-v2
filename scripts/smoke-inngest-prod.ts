import { inngest } from '../src/inngest/client';

const mode = inngest.mode;

if (process.env.INNGEST_EVENT_KEY && mode !== 'cloud') {
  throw new Error(`Expected Inngest production mode when INNGEST_EVENT_KEY is set, got ${mode}`);
}

if (mode === 'dev') {
  console.log('Inngest client initialized in dev mode');
} else {
  console.log('Inngest client initialized in production mode');
}
