// src/lib/shutdown.ts
//
// Shared shutdown vocabulary for the server and worker entrypoints. A
// platform signal is a normal stop and exits 0; a crash-sourced shutdown
// exits 1 even after a clean drain, so the supervisor records the failure
// and restarts the process.
export type ShutdownReason =
  | 'SIGINT'
  | 'SIGTERM'
  | 'uncaughtException'
  | 'unhandledRejection';

export const shutdownExitCode = (reason: ShutdownReason): 0 | 1 =>
  reason === 'SIGTERM' || reason === 'SIGINT' ? 0 : 1;
