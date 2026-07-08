## 1. Fix SystemInfo Interface

- [x] 1.1 Update `src/stores/socket.ts` SystemInfo interface to use camelCase field names
  - Change `cpu_count` → `cpuCount`
  - Change `total_mem` → `totalMem`
  - Change `free_mem` → `freeMem`
- [x] 1.2 Run `npx tsc --noEmit` to verify no type errors

## 2. Verify SystemStats Component

- [x] 2.1 Confirm SystemStats.tsx accesses correct field names
  - `systemInfo.cpuCount` (not `cpu_count`)
  - `systemInfo.totalMem` (not `total_mem`)
  - `systemInfo.freeMem` (not `free_mem`)
- [x] 2.2 Test display shows correct memory values (not NaN)