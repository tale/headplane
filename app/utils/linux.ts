import fs from 'node:fs/promises';
import * as path from 'path';


async function findPidByName(partialCommand: string): Promise<number | null> {
    const procDir = '/proc';

    const procDirs = await fs.readdir(procDir)
  
    for (const dir of procDirs) {
      const pid = parseInt(dir, 10);
  
      if (!isNaN(pid)) {
        const cmdlinePath = path.join(procDir, dir, 'cmdline');
        try {
          const cmdline = await fs.readFile(cmdlinePath, 'utf8');
          if (cmdline.includes(partialCommand)) {
            return pid;
          }
        } catch (error) {
          return null
        }
      }
    }
  
    return null;
  }


async function findHeadscalePid() {
    const partialCommand = 'headscale';
    const pid = await findPidByName(partialCommand);
    return pid
}

async function sendSignal(pid: number, signal: NodeJS.Signals) {
    try {
      process.kill(pid, signal);
      console.log(`Signal ${signal} sent to process with PID ${pid}`);
    } catch (error) {
      console.error(`Failed to send signal: ${error}`);
    }
  }

export async function sighupHeadscale() {
    const pid = await findHeadscalePid()
    console.log(`sighup headscale process ${pid}`)
    const signal: NodeJS.Signals = 'SIGHUP';

    if (pid) {
      await sendSignal(pid, signal);
    }
}