// hooks/useSmartRefresh.ts
import { useAuth } from '@/auth/AuthContext';
import { useCallback, useRef } from 'react';

const REFRESH_COOLDOWN_MS = 4 * 60 * 1000; // 4 minutes cooldown between refreshes (1 min before 5min threshold)
const globalRefreshState = {
  lastRefreshTime: 0,
  isRefreshing: false,
  pendingCallbacks: new Set<() => void>(),
};

/**
 * Smart session refresh hook that prevents duplicate refresh calls
 * and coordinates refresh requests across multiple screens
 */
export function useSmartRefresh() {
  const { refreshSession, refreshing, session } = useAuth();
  const callbackRef = useRef<(() => void) | null>(null);

  const smartRefresh = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - globalRefreshState.lastRefreshTime;

    // If we're already refreshing, wait for it to complete
    if (globalRefreshState.isRefreshing || refreshing) {
      return new Promise<void>((resolve) => {
        globalRefreshState.pendingCallbacks.add(resolve);
      });
    }

    // Check if token actually needs refresh (5 minutes before expiry)
    if (session?.expiresAt) {
      const expiresMs = Date.parse(session.expiresAt);
      if (!isNaN(expiresMs)) {
        const timeUntilExpiry = expiresMs - now;
        const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        
        // Only refresh if we're within 5 minutes of expiry
        if (timeUntilExpiry > REFRESH_THRESHOLD) {
          console.log(`🔄 Token still valid for ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, skipping refresh`);
          return;
        }
      }
    }

    // If we refreshed recently, skip
    if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS) {
      console.log(`🔄 Refresh cooldown active, ${Math.round((REFRESH_COOLDOWN_MS - timeSinceLastRefresh) / 1000)}s remaining`);
      return;
    }

    // Mark as refreshing and update timestamp
    globalRefreshState.isRefreshing = true;
    globalRefreshState.lastRefreshTime = now;

    console.log('🔄 Starting smart refresh session...');
    try {
      await refreshSession();
      console.log('✅ Smart refresh completed successfully');
    } catch (error) {
      console.error('❌ Smart refresh failed:', error);
      // Reset timestamp on error to allow retry
      globalRefreshState.lastRefreshTime = 0;
      throw error;
    } finally {
      globalRefreshState.isRefreshing = false;
      
      // Notify all pending callbacks
      const callbacks = Array.from(globalRefreshState.pendingCallbacks);
      globalRefreshState.pendingCallbacks.clear();
      callbacks.forEach(callback => callback());
    }
  }, [refreshSession, refreshing, session]);

  const scheduleRefresh = useCallback(() => {
    // Store callback for cleanup
    callbackRef.current = () => smartRefresh().catch(() => {});
    
    // Schedule for next tick to avoid blocking navigation
    const timeoutId = setTimeout(callbackRef.current, 0);
    
    return () => {
      clearTimeout(timeoutId);
      if (callbackRef.current) {
        globalRefreshState.pendingCallbacks.delete(callbackRef.current);
        callbackRef.current = null;
      }
    };
  }, [smartRefresh]);

  return { scheduleRefresh, isRefreshing: refreshing || globalRefreshState.isRefreshing };
}
