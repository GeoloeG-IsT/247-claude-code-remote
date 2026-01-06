import config from '../config.json' with { type: 'json' };

export async function registerWithDashboard(): Promise<void> {
  try {
    const response = await fetch(`${config.dashboard.apiUrl}/machines/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.dashboard.apiKey}`,
      },
      body: JSON.stringify({
        id: config.machine.id,
        name: config.machine.name,
        config: {
          projects: config.projects.whitelist,
          agentUrl: config.agent?.url || 'localhost:4678',
        },
      }),
    });

    if (response.ok) {
      console.log('Registered with dashboard');
    } else {
      console.error('Registration failed:', await response.text());
    }
  } catch (err) {
    console.error('Failed to register with dashboard:', err);
  }
}

export function startHeartbeat(): void {
  // Send heartbeat every 5 minutes (reduced from 30 seconds)
  setInterval(registerWithDashboard, 5 * 60 * 1000);
}
