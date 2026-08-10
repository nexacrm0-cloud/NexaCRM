'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-96 flex-col items-center justify-center gap-4">
          <div className="text-destructive text-lg font-medium">Algo salió mal</div>
          <p className="text-muted-foreground text-sm">
            {this.state.error?.message || 'Error inesperado en la interfaz'}
          </p>
          <Button onClick={this.handleRetry}>Reintentar</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
