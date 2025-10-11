// hooks/useOptimizedFavorites.ts
import { useAuth } from '@/auth/AuthContext';
import { useAuthedFetch } from '@/auth/useAuthedFetch';
import { BASE_URL } from '@/constants/API';
import { favoritesLogger } from '@/utils/logger';
import { useCallback, useRef } from 'react';

interface FavoriteToggleOptions {
  title: string;
  author: string;
  languageId: string;
  currentState: boolean;
  onOptimisticUpdate?: (newState: boolean) => void;
  onError?: (error: Error, rollbackState: boolean) => void;
}

/**
 * Optimized favorites management with optimistic updates and request deduplication
 */
export function useOptimizedFavorites() {
  const { markFavoritesDirty } = useAuth();
  const { authedFetch } = useAuthedFetch();
  const pendingRequests = useRef<Map<string, Promise<boolean>>>(new Map());

  const toggleFavorite = useCallback(async ({
    title,
    author,
    languageId,
    currentState,
    onOptimisticUpdate,
    onError,
  }: FavoriteToggleOptions): Promise<boolean> => {
    const newState = !currentState;
    
    // Create unique key for this book
    const bookKey = `${title}|||${author}|||${languageId}`;
    
    // Check if there's already a pending request for this book
    const existingRequest = pendingRequests.current.get(bookKey);
    if (existingRequest) {
      favoritesLogger.info('Deduplicating favorite toggle request', { title, author });
      return existingRequest;
    }

    // Optimistically update UI immediately
    onOptimisticUpdate?.(newState);

    const requestPromise = (async (): Promise<boolean> => {
      try {
        const method = newState ? 'POST' : 'DELETE';
        
        favoritesLogger.info(`${newState ? 'Adding' : 'Removing'} favorite`, { 
          title, 
          author,
          method,
          optimisticState: newState 
        });

        const body = JSON.stringify({
          title,
          author,
          languageId,
        });

        const response = await authedFetch(`${BASE_URL}/favorites`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || 'Não foi possível atualizar favorito.');
        }

        // Mark favorites as dirty to trigger cache invalidation
        markFavoritesDirty();
        
        favoritesLogger.info('Favorite toggle successful', { title, author, newState });
        return newState;
        
      } catch (error) {
        favoritesLogger.error('Favorite toggle failed', { title, author, error });
        
        // Rollback optimistic update on error
        onError?.(error instanceof Error ? error : new Error('Unknown error'), currentState);
        
        throw error;
      } finally {
        // Clean up pending request
        pendingRequests.current.delete(bookKey);
      }
    })();

    // Store the pending request to prevent duplicates
    pendingRequests.current.set(bookKey, requestPromise);
    
    return requestPromise;
  }, [authedFetch, markFavoritesDirty]);

  const isPending = useCallback((title: string, author: string, languageId: string): boolean => {
    const bookKey = `${title}|||${author}|||${languageId}`;
    return pendingRequests.current.has(bookKey);
  }, []);

  return {
    toggleFavorite,
    isPending,
  };
}
