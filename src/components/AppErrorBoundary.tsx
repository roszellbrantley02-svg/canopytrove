import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { captureMonitoringException } from '../services/sentryMonitoringService';
import { ErrorRecoveryCard } from './ErrorRecoveryCard';

type AppErrorBoundaryProps = {
  area: string;
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  override componentDidCatch(error: Error) {
    captureMonitoringException(error, {
      source: 'react-error-boundary',
      tags: {
        area: this.props.area,
      },
    });
  }

  private readonly handleRetry = () => {
    this.setState({
      hasError: false,
    });
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <ErrorRecoveryCard
          title="This part of the app ran into a problem."
          message="The rest of the app is still okay. Try opening this section again."
          onRetry={this.handleRetry}
          retryLabel="Try Again"
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
});
