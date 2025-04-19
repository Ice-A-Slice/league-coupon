# React Component Organization Best Practices

## Current Structure Analysis

Your current project structure follows a hybrid approach:

```
src/components/
├── SectionContainer.tsx  <-- Shared component at root level
├── BettingCoupon/
│   ├── BettingCoupon.tsx
│   ├── index.ts  <-- Re-exports the component
│   └── types.ts
├── Questionnaire/
│   ├── Questionnaire.tsx
│   ├── PlayerSelect.tsx
│   ├── TeamSelect.tsx
│   ├── index.ts
│   └── types.ts
└── ui/
    ├── button.tsx
    ├── toggle-button.tsx
    ├── badge.tsx
    └── ...
```

## Best Practices for Component Organization

### 1. Using index.ts Files

**Current Usage:**
```typescript
// BettingCoupon/index.ts
export * from './BettingCoupon';
export { default } from './BettingCoupon';
```

**Benefits:**
- ✅ Enables cleaner imports: `import BettingCoupon from '@/components/BettingCoupon'` instead of `import BettingCoupon from '@/components/BettingCoupon/BettingCoupon'`
- ✅ Provides a public API for each module/folder
- ✅ Makes refactoring easier (you can change internal file names without changing import paths)

**Best Practice:** Using index.ts files as you're doing is excellent practice. It creates a clean public API for each component folder.

### 2. Shared Components Placement

**Current:** SectionContainer is at the root of the components folder.

**Options:**

1. **Root Level (Current Approach):**
   - ✅ Easy to find and import
   - ✅ Clearly indicates it's a shared component
   - ❌ As the project grows, the root folder can become cluttered

2. **Dedicated "shared" or "common" Folder:**
   ```
   src/components/
   ├── shared/
   │   └── SectionContainer.tsx
   ├── BettingCoupon/
   └── ...
   ```
   - ✅ Better organization as the project scales
   - ✅ Clear indication of shared components
   - ✅ Prevents root folder clutter

3. **Layout Components Folder:**
   ```
   src/components/
   ├── layout/
   │   └── SectionContainer.tsx
   ├── BettingCoupon/
   └── ...
   ```
   - ✅ Specifically for layout/structural components
   - ✅ Separates layout concerns from feature components

**Recommendation:** For a growing project, option 2 or 3 is better. Since SectionContainer is a layout component, a `layout` folder would be most appropriate.

### 3. Overall Component Organization

Your current organization follows these patterns:

1. **Feature-based organization:** BettingCoupon and Questionnaire folders
2. **Type-based organization:** UI components in the ui folder

This hybrid approach is excellent and follows industry best practices:

```
src/components/
├── layout/                  <-- Layout components
│   └── SectionContainer.tsx
├── ui/                      <-- Generic UI components
│   ├── button.tsx
│   ├── toggle-button.tsx
│   └── ...
├── BettingCoupon/           <-- Feature-specific components
│   ├── BettingCoupon.tsx
│   ├── index.ts
│   └── types.ts
└── Questionnaire/           <-- Feature-specific components
    ├── Questionnaire.tsx
    └── ...
```

**Additional Best Practices:**

1. **Consistent Naming:**
   - Use PascalCase for component files and folders (React convention)
   - Use kebab-case for utility files
   - Be consistent with singular vs. plural naming

2. **Co-location of Tests:**
   - Keep tests close to the components they test
   - Either in the same folder or in a `__tests__` subfolder (as you're doing)

3. **Types Organization:**
   - Your approach of having a `types.ts` file in each feature folder is good
   - For shared types, consider a `types` folder at the root level

4. **Barrel Exports:**
   - Your use of index.ts files for re-exporting is excellent
   - Consider doing the same for the ui folder to enable `import { Button, ToggleButton } from '@/components/ui'`

## Recommendations for Your Project

Based on your current structure and best practices:

1. **Move SectionContainer to a layout folder:**
   ```
   src/components/layout/SectionContainer.tsx
   src/components/layout/index.ts  // Re-export
   ```

2. **Add an index.ts to the ui folder:**
   ```typescript
   // src/components/ui/index.ts
   export * from './button';
   export * from './toggle-button';
   export * from './badge';
   // etc.
   ```

3. **Consider a shared types folder for cross-cutting types:**
   ```
   src/types/index.ts
   ```

4. **Maintain your current feature-based organization:**
   - Keep BettingCoupon and Questionnaire as separate folders
   - Continue using index.ts files for clean exports

This structure will scale well as your project grows and follows React community best practices.