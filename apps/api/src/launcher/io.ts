import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface LauncherIo {
  print(message: string): void;
  prompt(question: string): Promise<string>;
  isInteractive(): boolean;
}

export function createStdio(): LauncherIo {
  return {
    print(message: string) {
      stdout.write(`${message}\n`);
    },
    async prompt(question: string) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      try {
        return (await rl.question(`${question} `)).trim();
      } finally {
        rl.close();
      }
    },
    isInteractive() {
      return Boolean(stdin.isTTY);
    },
  };
}
