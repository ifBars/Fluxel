## Description

<!-- Provide a clear and concise description of what this PR does -->

## Type of Change

<!-- Mark the relevant option with an 'x' -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Build/CI configuration
- [ ] Other (please describe):

## Related Issues

<!-- Link to related issues using keywords like "Fixes", "Closes", "Relates to" -->
<!-- Example: Fixes #123, Relates to #456 -->

-

## Motivation and Context

<!-- Why is this change needed? What problem does it solve? -->

## Changes Made

<!-- List the key changes made in this PR -->

-
-
-

## Screenshots / Recordings

<!-- If applicable, add screenshots or screen recordings to demonstrate the changes -->
<!-- For UI changes, include before/after screenshots -->

<details>
<summary>Screenshots (click to expand)</summary>

<!-- Paste screenshots here -->

</details>

## Testing

<!-- Describe how you tested your changes -->

### Manual Testing

<!-- Detail the manual testing you performed -->

- [ ] Tested in development mode (`bun run tauri dev`)
- [ ] Tested in production build (if applicable)
- [ ] Tested on multiple platforms (specify which):
  - [ ] Windows
  - [ ] macOS
  - [ ] Linux

### Test Coverage

<!-- Describe test scenarios you verified -->

- [ ] Core functionality works as expected
- [ ] Edge cases handled appropriately
- [ ] Error states display correctly
- [ ] No console errors or warnings
- [ ] No TypeScript errors (`bun x tsc` passes)

## Code Quality

<!-- Verify your code meets quality standards -->

- [ ] My code follows the project's [Coding Standards](../CODING_STANDARDS.md)
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary (complex logic, edge cases)
- [ ] My changes generate no new warnings or errors
- [ ] I have updated documentation as needed

## Frontend Checklist

<!-- If your PR includes frontend changes, verify the following -->

- [ ] Components use TypeScript with proper type definitions
- [ ] Imports use `@/*` path aliases
- [ ] Styles use Tailwind CSS utilities (no inline styles unless necessary)
- [ ] State management follows Zustand patterns
- [ ] Component variants use CVA (if applicable)
- [ ] Responsive design tested on different screen sizes
- [ ] Both light and dark themes work correctly
- [ ] Accessibility considerations addressed (keyboard navigation, ARIA labels)

## Backend Checklist

<!-- If your PR includes Rust/Tauri changes, verify the following -->

- [ ] Commands are properly registered in `lib.rs`
- [ ] Error handling uses `Result<T, String>` pattern
- [ ] Rust code compiles without warnings (`cargo check`)
- [ ] Commands are properly documented
- [ ] State management follows Tauri patterns
- [ ] Feature flags used appropriately (if applicable)

## Breaking Changes

<!-- If this PR includes breaking changes, describe them here -->
<!-- Include migration guide for users/developers -->

- [ ] This PR includes breaking changes
- [ ] Migration guide provided (below or in documentation)

<details>
<summary>Breaking Changes Details (click to expand)</summary>

<!-- Describe breaking changes and how to migrate -->

</details>

## Dependencies

<!-- If you added new dependencies, justify them -->

### New Dependencies Added

<!-- List any new dependencies with justification -->

- `package-name` - Reason for adding this dependency
-

### Dependencies Removed

<!-- List any removed dependencies -->

-

## Performance Impact

<!-- Describe any performance implications of your changes -->

- [ ] No significant performance impact
- [ ] Performance improvement (describe below)
- [ ] Potential performance concern (describe below and mitigation)

<details>
<summary>Performance Notes (click to expand)</summary>

<!-- Add details about performance impact -->

</details>

## Deployment Notes

<!-- Any special considerations for deployment? -->
<!-- Build steps, configuration changes, migrations needed? -->

## Additional Notes

<!-- Any other information reviewers should know -->

## Reviewer Checklist

<!-- For reviewers - do not fill this out as the PR author -->

- [ ] Code follows project coding standards
- [ ] Changes are well-tested
- [ ] Documentation is updated
- [ ] No unnecessary dependencies added
- [ ] Performance impact is acceptable
- [ ] Security considerations addressed
- [ ] Breaking changes are justified and documented

---

**By submitting this PR, I confirm that:**

- [ ] I have read the [Contributing Guidelines](../CONTRIBUTING.md)
- [ ] My code follows the [Coding Standards](../CODING_STANDARDS.md)
- [ ] I have tested my changes thoroughly
- [ ] I am willing to address review feedback
