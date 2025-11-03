import * as React from 'react';

export const ShadcnGlassStyles = () => (
  <style>{`
    :root {
      color-scheme: dark;

      /* Backgrounds - Deep Black */
      --glass-background: rgba(26, 26, 32, 0.85);
      --glass-surface: rgba(32, 32, 38, 0.80);
      --glass-border: rgba(239, 68, 68, 0.20);
      --glass-card: rgba(15, 15, 18, 0.70);
      --glass-card-highlight: rgba(59, 130, 246, 0.15);

      /* Primary - Red Glows */
      --glass-highlight: rgba(239, 68, 68, 0.18);
      --glass-success: rgba(34, 197, 94, 0.42);
      --glass-warning: rgba(251, 191, 36, 0.48);
      --glass-danger: rgba(239, 68, 68, 0.62);

      /* Accent Colors - Red & Blue */
      --ring: rgba(59, 130, 246, 0.32);
      --foreground: #ffffff;
      --muted: rgba(226, 232, 240, 0.78);
      --accent: rgba(239, 68, 68, 0.88);
      --accent-strong: #ef4444;

      --font-family: 'Inter', 'JetBrains Mono', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .glass-ui {
      position: relative;
      min-height: 100vh;
      padding: clamp(3rem, 5vw, 4rem) clamp(1.75rem, 4vw, 3rem) clamp(2.5rem, 4vw, 3rem);
      font-family: var(--font-family);
      color: var(--foreground);
      background: radial-gradient(circle at top left, rgba(239, 68, 68, 0.08), transparent 55%),
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 60%),
        radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.06), transparent 50%),
        radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.06), transparent 50%),
        linear-gradient(180deg, #0a0a15, #1a1a2e);
      overflow: hidden;
    }

    .glass-ui::before {
      content: '';
      position: absolute;
      width: 36rem;
      height: 36rem;
      background: radial-gradient(circle, rgba(239, 68, 68, 0.12), transparent 70%);
      filter: blur(120px);
      z-index: 0;
      opacity: 0.25;
      animation: float 28s ease-in-out infinite;
      will-change: transform;
      top: -16rem;
      left: -12rem;
    }

    .glass-ui::after {
      content: '';
      position: absolute;
      width: 36rem;
      height: 36rem;
      bottom: -18rem;
      right: -14rem;
      animation-delay: 9s;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.10), transparent 70%);
      filter: blur(120px);
      z-index: 0;
      opacity: 0.25;
      animation: float 28s ease-in-out infinite;
      will-change: transform;
    }

    .glass-ui a {
      color: inherit;
    }

    .app-layout {
      position: relative;
      display: grid;
      grid-template-columns: clamp(84px, 8vw, 120px) minmax(0, 1fr);
      gap: clamp(1.5rem, 3vw, 2.8rem);
      align-items: flex-start;
      min-height: calc(100vh - 5rem);
    }

    .dock-nav {
      position: sticky;
      top: clamp(2rem, 4vw, 3rem);
      z-index: 3;
      align-self: flex-start;
    }

    .dock-surface {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.6rem;
      padding: 1.6rem 1.15rem;
      border-radius: 2rem;
      background: linear-gradient(180deg, rgba(32, 32, 38, 0.95), rgba(15, 15, 18, 0.90));
      border: 1px solid rgba(239, 68, 68, 0.22);
      box-shadow: 0 16px 32px -24px rgba(239, 68, 68, 0.35);
      backdrop-filter: blur(16px) saturate(1.2);
      overflow: hidden;
    }

    .dock-surface::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(circle at 50% 15%, rgba(239, 68, 68, 0.15), transparent 65%);
      opacity: 0.6;
      pointer-events: none;
    }

    .dock-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--muted);
      font-size: 0.68rem;
      position: relative;
      z-index: 1;
    }

    .dock-brand-badge {
      width: 2.65rem;
      height: 2.65rem;
      border-radius: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid rgba(239, 68, 68, 0.28);
      box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.22),
                  0 0 20px rgba(239, 68, 68, 0.12);
      color: var(--foreground);
    }

    .dock-brand-text {
      font-weight: 700;
    }

    .dock-brand-sub {
      font-weight: 500;
      letter-spacing: 0.28em;
      font-size: 0.62rem;
    }

    .dock-items {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
      position: relative;
      z-index: 1;
    }

    .dock-item {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0.85rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(239, 68, 68, 0.12);
      background: rgba(15, 15, 18, 0.45);
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
                  background-color 0.15s ease,
                  box-shadow 0.15s ease;
      position: relative;
      overflow: hidden;
      will-change: transform;
      backface-visibility: hidden;
    }

    .dock-item::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(120deg, rgba(239, 68, 68, 0.18), transparent 55%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .dock-item:hover {
      transform: translateX(4px) scale(1.02);
      background: linear-gradient(145deg, rgba(239, 68, 68, 0.15), rgba(32, 32, 38, 0.15));
      color: var(--foreground);
      border-color: rgba(239, 68, 68, 0.32);
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.18);
    }

    .dock-item:hover::after {
      opacity: 1;
    }

    .dock-item:hover .dock-icon {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.25);
    }

    .dock-item-active {
      background: linear-gradient(145deg, rgba(239, 68, 68, 0.25), rgba(59, 130, 246, 0.20));
      color: var(--foreground);
      border-color: rgba(239, 68, 68, 0.42);
      box-shadow: 0 16px 32px -20px rgba(239, 68, 68, 0.45),
                  0 0 24px rgba(239, 68, 68, 0.25);
    }

    .dock-item-active .dock-icon {
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.28);
    }

    .dock-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.65rem;
      height: 2.65rem;
      border-radius: 1rem;
      background: rgba(15, 15, 18, 0.62);
      border: 1px solid rgba(239, 68, 68, 0.20);
      color: inherit;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }

    .dock-item-active .dock-icon {
      background: rgba(239, 68, 68, 0.22);
      border-color: rgba(239, 68, 68, 0.42);
      transform: scale(1.08);
      box-shadow: 0 0 25px rgba(59, 130, 246, 0.28);
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .dock-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      font-size: 0.65rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(216, 222, 233, 0.58);
      position: relative;
      z-index: 1;
    }

    .app-shell {
      position: relative;
      z-index: 2;
      display: grid;
      gap: clamp(1.75rem, 2.8vw, 2.6rem);
      overflow-y: auto;
      padding-right: clamp(0.65rem, 1vw, 0.85rem);
      padding-bottom: 4rem;
      max-height: calc(100vh - 9rem);
      scroll-behavior: smooth;
    }

    .section-stack {
      display: grid;
      gap: 1.5rem;
      position: relative;
    }

    .section-header {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      padding-left: 0.2rem;
    }

    .section-kicker {
      font-size: 0.68rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
    }

    .section-title {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      font-size: clamp(1.1rem, 2vw, 1.45rem);
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .section-summary {
      color: rgba(216, 222, 233, 0.78);
      max-width: 36rem;
      font-size: 0.94rem;
      line-height: 1.55;
    }

    .section-grid {
      display: grid;
      gap: clamp(1.25rem, 2vw, 1.75rem);
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    }

    .hero-banner {
      display: grid;
      gap: 1rem;
      padding: clamp(1.85rem, 3vw, 2.5rem);
      border-radius: 1.9rem;
      background: linear-gradient(145deg, rgba(239, 68, 68, 0.18), rgba(32, 32, 38, 0.25));
      border: 1px solid rgba(239, 68, 68, 0.22);
      box-shadow: 0 24px 48px -32px rgba(239, 68, 68, 0.38),
                  0 0 48px rgba(59, 130, 246, 0.10);
      overflow: hidden;
      position: relative;
    }

    .hero-banner::after {
      content: '';
      position: absolute;
      inset: -40%;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.12), transparent 70%);
      filter: blur(220px);
      z-index: -1;
    }

    .hero-title {
      font-size: clamp(2.2rem, 4vw, 3rem);
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    .hero-subtitle {
      color: var(--muted);
      max-width: 42rem;
      font-size: clamp(1rem, 1.8vw, 1.12rem);
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.6rem;
    }

    .metrics-panel {
      display: grid;
      gap: 1.1rem;
      padding: clamp(1.35rem, 2vw, 1.8rem);
      border-radius: 1.6rem;
      background: linear-gradient(145deg, rgba(32, 32, 38, 0.58), rgba(15, 15, 18, 0.52));
      border: 1px solid rgba(239, 68, 68, 0.22);
      box-shadow: 0 16px 32px -24px rgba(239, 68, 68, 0.35);
      backdrop-filter: blur(16px) saturate(1.2);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: 1.25rem;
    }

    .metric-blip {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .metric-label {
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.75rem;
      color: var(--muted);
    }

    .metric-value {
      font-size: 1.75rem;
      font-weight: 600;
    }

    @media (max-width: 1024px) {
      .app-layout {
        grid-template-columns: 1fr;
      }

      .dock-nav {
        position: fixed;
        top: auto;
        bottom: clamp(1.5rem, 6vw, 2.75rem);
        left: 50%;
        transform: translateX(-50%);
        width: min(90%, 28rem);
        contain: layout style;
      }

      .dock-surface {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 1.25rem;
        border-radius: 1.5rem;
        backdrop-filter: blur(12px) saturate(1.15);
      }

      .dock-items {
        flex-direction: row;
        justify-content: center;
        gap: 0.65rem;
      }

      .dock-footer {
        display: none;
      }

      .app-shell {
        max-height: none;
        padding-bottom: 6.5rem;
        padding-right: 0;
      }
    }

    @media (max-width: 640px) {
      .hero-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      }
    }

    .timeline {
      display: grid;
      gap: 1rem;
    }

    .timeline-item {
      display: grid;
      gap: 0.35rem;
      padding: 0.95rem 1.1rem;
      border-radius: 1.1rem;
      background: rgba(15, 15, 18, 0.4);
      border: 1px solid rgba(239, 68, 68, 0.1);
      transition: all 0.2s ease;
    }

    .timeline-item:hover {
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.18);
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
    }

    .timeline-item strong {
      font-weight: 600;
      color: var(--foreground);
    }

    .timeline-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .chip {
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.22);
      color: var(--foreground);
      font-size: 0.8rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      transition: all 0.2s ease;
    }

    .chip:hover {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.32);
      box-shadow: 0 0 15px rgba(239, 68, 68, 0.18);
    }

    .lozenge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: linear-gradient(145deg, rgba(239, 68, 68, 0.22), rgba(59, 130, 246, 0.18));
      border: 1px solid rgba(239, 68, 68, 0.32);
    }

    .lozenge-warning {
      background: rgba(255, 159, 10, 0.22);
      border-color: rgba(255, 159, 10, 0.38);
    }

    .lozenge-danger {
      background: rgba(255, 69, 58, 0.24);
      border-color: rgba(255, 69, 58, 0.42);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .data-table th,
    .data-table td {
      padding: 0.75rem 0.65rem;
      text-align: left;
    }

    .data-table thead th {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.7rem;
      color: var(--muted);
      font-weight: 600;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .data-table tbody tr:not(:last-child) td {
      border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    }

    .grid-gap {
      display: grid;
      gap: 1rem;
    }

    @keyframes pulseMetric {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.75;
        transform: scale(1.04);
      }
    }

    .metric-value {
      transition: all 0.3s ease-in-out;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .score-bar {
      display: inline-block;
      height: 4px;
      border-radius: 2px;
      transition: width 0.4s ease-in-out;
      min-width: 4px;
      max-width: 100%;
      margin-left: 0.5rem;
    }

    .smart-strategy-grid {
      display: grid;
      gap: 0.65rem;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .smart-strategy-option {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      border-radius: 0.85rem;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: rgba(15, 23, 42, 0.35);
      padding: 0.6rem 0.75rem;
      transition: border-color 0.2s ease, background 0.2s ease;
    }

    .smart-strategy-option input[type='checkbox'] {
      margin-top: 0.2rem;
      accent-color: rgba(239, 68, 68, 0.65);
    }

    .smart-strategy-option:hover {
      border-color: rgba(239, 68, 68, 0.35);
      background: rgba(239, 68, 68, 0.12);
    }

    .strategy-label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.15rem;
    }

    .strategy-hint {
      display: block;
      font-size: 0.75rem;
      line-height: 1.3;
      color: var(--muted);
    }

    .smart-retrieval-layout {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: minmax(0, 0.44fr) minmax(0, 0.56fr);
    }

    @media (max-width: 1024px) {
      .smart-retrieval-layout {
        grid-template-columns: 1fr;
      }
    }

    .smart-answer-panel {
      position: relative;
      padding: 1.3rem;
      border-radius: 1.25rem;
      background: linear-gradient(145deg, rgba(239, 68, 68, 0.16), rgba(15, 23, 42, 0.5));
      border: 1px solid rgba(239, 68, 68, 0.3);
      box-shadow: 0 26px 48px -28px rgba(239, 68, 68, 0.45);
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      min-height: 100%;
    }

    .smart-answer-panel::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(circle at top left, rgba(239, 68, 68, 0.25), transparent 55%);
      opacity: 0.6;
      pointer-events: none;
    }

    .smart-answer-panel > * {
      position: relative;
      z-index: 1;
    }

    .chip-column {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .smart-answer-content {
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(239, 68, 68, 0.22);
      border-radius: 1rem;
      padding: 1rem;
      font-size: 0.92rem;
      line-height: 1.6;
      color: rgba(248, 250, 252, 0.92);
      max-height: 240px;
      overflow: auto;
      white-space: pre-wrap;
    }

    .smart-answer-content code {
      font-family: var(--font-mono, 'Fira Code', monospace);
    }

    .smart-results-panel {
      display: grid;
      gap: 1.25rem;
    }

    .smart-results-panel .chip-row + .chip-row {
      margin-top: -0.25rem;
    }

    @keyframes float {
      0%, 100% {
        transform: translate3d(0, 0, 0) scale(1);
      }
      40% {
        transform: translate3d(12px, -18px, 0) scale(1.05);
      }
      70% {
        transform: translate3d(-18px, 16px, 0) scale(0.98);
      }
    }

    /* shadcn-inspired primitives with liquid glass enhancements */
    .card {
      position: relative;
      border-radius: 1.5rem;
      background: linear-gradient(145deg, rgba(15, 15, 18, 0.70), rgba(26, 26, 32, 0.65));
      border: 1px solid rgba(239, 68, 68, 0.18);
      box-shadow: 0 8px 16px -12px rgba(239, 68, 68, 0.25);
      backdrop-filter: blur(16px) saturate(1.2);
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 32px -24px rgba(239, 68, 68, 0.35),
                  0 0 24px rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.28);
    }

    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      border: 1px solid rgba(239, 68, 68, 0.08);
      mask: linear-gradient(#000, rgba(0, 0, 0, 0));
      pointer-events: none;
    }

    .card-header {
      padding: 1.5rem 1.6rem 0.25rem;
      display: grid;
      gap: 0.45rem;
      position: relative;
      z-index: 1;
    }

    .card-title {
      font-size: 1.12rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }

    .card-description {
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.45;
    }

    .card-content {
      padding: 0 1.6rem 1.6rem;
      display: grid;
      gap: 1rem;
      position: relative;
      z-index: 1;
    }

    .card-footer {
      padding: 1rem 1.6rem 1.6rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      position: relative;
      z-index: 1;
    }

    .btn-base {
      border: none;
      cursor: pointer;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                  box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                  background 0.2s ease;
      position: relative;
      overflow: hidden;
      color: var(--foreground);
      will-change: transform; /* GPU optimization */
    }

    .btn-base::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      background: linear-gradient(120deg, rgba(255, 255, 255, 0.15), transparent 40%, rgba(148, 163, 184, 0.2));
      transform: translateX(-100%);
    }

    .btn-base:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 20px 32px -20px rgba(239, 68, 68, 0.42),
                  0 0 25px rgba(239, 68, 68, 0.22);
    }

    .btn-base:hover::after {
      opacity: 1;
      transform: translateX(100%);
    }

    .btn-base:active {
      transform: translateY(0) scale(0.98);
    }

    .btn-md {
      height: 2.8rem;
      padding: 0 1.35rem;
      font-size: 0.95rem;
    }

    .btn-sm {
      height: 2.35rem;
      padding: 0 1rem;
      font-size: 0.85rem;
    }

    .btn-lg {
      height: 3.15rem;
      padding: 0 1.65rem;
      font-size: 1.05rem;
    }

    .btn-icon {
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
    }

    .btn-default {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.88));
    }

    .btn-secondary {
      background: rgba(32, 32, 38, 0.82);
      border: 1px solid rgba(239, 68, 68, 0.22);
    }

    .btn-outline {
      background: rgba(15, 15, 18, 0.45);
      border: 1px solid rgba(239, 68, 68, 0.25);
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.18);
    }

    .btn-destructive {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(248, 113, 113, 0.88));
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border-radius: 999px;
      font-weight: 600;
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.35rem 0.75rem;
      border: 1px solid transparent;
    }

    .badge-default {
      background: rgba(239, 68, 68, 0.18);
      border-color: rgba(239, 68, 68, 0.28);
    }

    .badge-secondary {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(239, 68, 68, 0.22);
    }

    .badge-outline {
      border-color: rgba(239, 68, 68, 0.25);
      color: var(--muted);
    }

    .badge-accent {
      background: linear-gradient(145deg, rgba(239, 68, 68, 0.22), rgba(59, 130, 246, 0.18));
      border-color: rgba(239, 68, 68, 0.32);
    }

    .separator {
      width: 100%;
      height: 1px;
      background: linear-gradient(90deg, rgba(148, 163, 184, 0), rgba(148, 163, 184, 0.32), rgba(148, 163, 184, 0));
    }

    .progress {
      position: relative;
      height: 0.55rem;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.14);
      overflow: hidden;
    }

    .progress-indicator {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(239, 68, 68, 0.88), rgba(59, 130, 246, 0.85));
      transition: width 0.28s ease;
    }

    .scroll-area {
      position: relative;
      overflow: hidden;
    }

    .scroll-area-viewport {
      overflow: auto;
      max-height: inherit;
      padding-right: 0.35rem;
    }

    .scroll-area-viewport::-webkit-scrollbar {
      width: 0.45rem;
    }

    .scroll-area-viewport::-webkit-scrollbar-track {
      background: rgba(148, 163, 184, 0.05);
      border-radius: 999px;
    }

    .scroll-area-viewport::-webkit-scrollbar-thumb {
      background: rgba(239, 68, 68, 0.35);
      border-radius: 999px;
    }

    .input,
    .textarea,
    .select {
      width: 100%;
      border-radius: 0.9rem;
      border: 1px solid rgba(148, 163, 184, 0.2);
      background: rgba(15, 23, 42, 0.55);
      color: var(--foreground);
      padding: 0.65rem 0.9rem;
      font-size: 0.92rem;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    }

    .input:focus,
    .textarea:focus,
    .select:focus {
      outline: none;
      border-color: rgba(239, 68, 68, 0.45);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
      background: rgba(15, 15, 18, 0.75);
    }

    .input::placeholder,
    .textarea::placeholder {
      color: rgba(148, 163, 184, 0.6);
    }

    .textarea {
      min-height: 6rem;
      resize: vertical;
    }

    .label {
      display: inline-block;
      font-size: 0.78rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 0.45rem;
    }

    .tabs {
      display: grid;
      gap: 0.75rem;
    }

    .tabs-list {
      display: inline-flex;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      padding: 0.35rem;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(12px);
      gap: 0.35rem;
    }

    .tabs-trigger {
      border-radius: 999px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.5rem 1.1rem;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }

    .tabs-trigger:hover {
      color: var(--foreground);
    }

    .tabs-trigger--active {
      background: rgba(239, 68, 68, 0.22);
      color: var(--foreground);
      box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.28);
    }

    .tabs-content {
      display: grid;
      gap: 1rem;
    }

    /* Accessibility: High contrast mode support */
    @media (prefers-contrast: more) {
      :root {
        --glass-background: rgba(20, 8, 8, 0.9);
        --glass-surface: rgba(40, 16, 16, 0.95);
        --glass-card: rgba(12, 6, 6, 0.9);
        --foreground: #ffffff;
        --muted: rgba(255, 255, 255, 0.95);
      }

      .card {
        backdrop-filter: blur(8px) saturate(1.5);
        border-width: 2px;
      }

      .btn-base,
      .badge,
      .chip,
      .lozenge {
        border-width: 2px;
      }

      .card-description,
      .metric-label,
      .timeline-meta {
        opacity: 1;
      }
    }

    /* Accessibility: Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }

      .glass-ui::before,
      .glass-ui::after {
        animation: none;
      }
    }

    /* Performance: Force GPU acceleration on key elements */
    .card,
    .btn-base,
    .hero-banner {
      transform: translateZ(0);
      backface-visibility: hidden;
    }
  `}</style>
);
