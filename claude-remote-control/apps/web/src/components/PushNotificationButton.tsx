'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationButtonProps {
  className?: string;
  isMobile?: boolean;
}

export function PushNotificationButton({
  className,
  isMobile = false,
}: PushNotificationButtonProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  const handleClick = async () => {
    if (!isSupported) return;
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const iconClass = isMobile ? 'h-5 w-5' : 'h-4 w-4';
  const isDisabled = isLoading || !isSupported;

  const getTitle = () => {
    if (!isSupported) return 'Push notifications not supported';
    if (isSubscribed) return 'Disable notifications';
    return 'Enable notifications';
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        'rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white',
        'touch-manipulation disabled:cursor-not-allowed disabled:opacity-50',
        isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-2',
        isSubscribed && 'text-orange-400 hover:text-orange-300',
        className
      )}
      title={getTitle()}
    >
      {isLoading ? (
        <Loader2 className={cn(iconClass, 'animate-spin')} />
      ) : isSubscribed ? (
        <Bell className={iconClass} />
      ) : (
        <BellOff className={iconClass} />
      )}
    </button>
  );
}
