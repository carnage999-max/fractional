'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If it's a chunk loading error, force a hard reload
    if (error.message?.includes('Loading chunk') || error.message?.includes('Failed to fetch')) {
      console.error('Chunk loading error detected, forcing hard reload:', error);
      
      // Clear any stored state that might be stale
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('hasReloadedForChunkError');
      }
      
      // Force hard reload to get fresh HTML and chunks
      window.location.reload();
    }
  }, [error]);

  return (
    <div style={{ 
      padding: '40px', 
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button
        onClick={() => {
          // Try to recover first
          reset();
          // If still fails after 1 second, force reload
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          marginTop: '20px'
        }}
      >
        Try again
      </button>
    </div>
  );
}
