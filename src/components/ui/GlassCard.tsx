'use client';

import React, { forwardRef } from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'panel';
  hoverable?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = 'card',
      hoverable = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseClass = variant === 'panel' ? 'glass-panel' : 'glass-card';
    const hoverClass = hoverable ? 'card-hover' : '';
    const combinedClassName = [baseClass, hoverClass, className].filter(Boolean).join(' ');

    return (
      <div ref={ref} className={combinedClassName} {...props}>
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
