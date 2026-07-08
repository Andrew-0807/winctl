## Context

SystemStats.tsx shows "0.0 GB" for memory and "-" for uptime. The backend appears correct, but we need to understand why the frontend isn't displaying values correctly.

## Goals / Non-Goals

**Goals:**
- Add debug logging to SystemStats to capture raw data
- Verify API response format
- Identify if issue is in data fetching or rendering

**Non-Goals:**
- Permanent debugging code (will be removed after diagnosis)

## Decisions

Add console.log statements in:
1. SystemStats.tsx - log systemInfo object when rendered
2. services.ts loadSystem - log the raw API response

## Risks / Trade-offs

Minimal risk - console.log only, easily removed.