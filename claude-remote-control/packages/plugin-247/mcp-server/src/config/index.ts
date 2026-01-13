export interface Config {
  agentUrl: string;
  timeout: number;
}

export function getConfig(): Config {
  const agentUrl = process.env.AGENT_247_URL || 'http://localhost:4678';
  const timeout = parseInt(process.env.AGENT_247_TIMEOUT || '30000', 10);

  return {
    agentUrl: agentUrl.replace(/\/$/, ''), // Remove trailing slash
    timeout,
  };
}
