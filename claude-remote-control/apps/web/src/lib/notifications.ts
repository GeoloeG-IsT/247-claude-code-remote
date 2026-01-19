import type { AttentionReason } from '247-shared';

const REASON_LABELS: Record<AttentionReason, string> = {
  permission: 'Permission requise',
  input: 'Input attendu',
  plan_approval: 'Approbation du plan',
  task_complete: 'Tâche terminée',
};

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('[Notifications] API not available');
    return 'denied';
  }
  const permission = await Notification.requestPermission();
  console.log('[Notifications] Permission requested:', permission);
  return permission;
}

export function showBrowserNotification(project: string, reason?: AttentionReason): void {
  console.log('[Notifications] showBrowserNotification called:', { project, reason });

  if (!('Notification' in window)) {
    console.log('[Notifications] API not available');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log('[Notifications] Permission not granted:', Notification.permission);
    return;
  }

  const title = `Claude - ${project}`;
  const body = reason ? REASON_LABELS[reason] : 'Attention requise';

  console.log('[Notifications] Creating notification:', { title, body });

  new Notification(title, {
    body,
    icon: '/icon-192x192.png',
    tag: `claude-${project}`, // Prevents duplicates per project
    requireInteraction: true,
  });

  console.log('[Notifications] Notification created successfully');
}
