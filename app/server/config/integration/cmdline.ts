export function isHeadscaleServeCmd(cmdline: string): boolean {
  return cmdline.includes('headscale') && cmdline.includes("serve");
}
