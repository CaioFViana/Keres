/**
 * The real server in a process of its own, for `shutdown.process.test.ts`: it boots like `server.ts` does,
 * says when it is listening, and on a line of stdin behaves as if it had been sent SIGTERM.
 *
 * The signal is raised from inside (`process.emit`) rather than by the operating system because Windows
 * has no SIGTERM to send: `kill` there ends the process on the spot, without running any handler. What the
 * test checks is what the handlers do, and that is the same either way.
 */
import { bootAndListen } from '../../src/boot';
import { auditService } from '../../src/services/AuditService';

// A record that is slow to write, as a busy database is: without the shutdown waiting for what is in flight,
// the process would be gone before the line landed.
const writeLine = auditService.recordNow.bind(auditService);
auditService.recordNow = async (input) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return writeLine(input);
};

await bootAndListen({
  onListening: ({ port }) => {
    console.log(`READY ${port}`);
  },
});

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  if (chunk.includes('stop')) process.emit('SIGTERM');
});
