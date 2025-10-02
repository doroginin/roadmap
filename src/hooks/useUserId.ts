import { useState, useEffect } from 'react';
import { getOrCreateUserID } from '../utils/uuid';

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const id = getOrCreateUserID();
      setUserId(id);
    } catch (error) {
      console.error('Failed to get or create user ID:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { userId, isLoading };
}

