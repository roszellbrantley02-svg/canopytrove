import React from 'react';
import { AppErrorBoundary } from './AppErrorBoundary';

/**
 * Higher-order component that wraps a screen with an AppErrorBoundary.
 * Prevents render errors from crashing the entire app.
 *
 * Usage:
 *   export default withScreenErrorBoundary(MyScreen, 'my-screen');
 */
export function withScreenErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  area: string,
): React.FC<P> {
  const ScreenWithErrorBoundary: React.FC<P> = (props) => (
    <AppErrorBoundary area={area}>
      <WrappedComponent {...props} />
    </AppErrorBoundary>
  );

  ScreenWithErrorBoundary.displayName = `withScreenErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ScreenWithErrorBoundary;
}
