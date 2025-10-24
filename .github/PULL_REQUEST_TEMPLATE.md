---
name: Pull Request
about: Propose changes to Reader Bot
title: ''
labels: ''
assignees: ''
---

## 📋 Description
<!-- Provide a brief description of the changes in this PR -->


## 🎯 Type of Change
<!-- Check all that apply -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Dependency update

## 🔗 Related Issues
<!-- Link to related issues using #issue_number -->
Fixes #
Relates to #

## 🧪 Testing
<!-- Describe the tests you ran to verify your changes -->

### Test Environment
- **Device:** [e.g., iPhone 14 Pro, Desktop Chrome]
- **OS:** [e.g., iOS 17, macOS 14]
- **Node.js version:** [e.g., 18.17.0]

### Test Cases
- [ ] Test case 1: Description
- [ ] Test case 2: Description
- [ ] Test case 3: Description

### Automated Tests
- [ ] All existing tests pass (`npm test`)
- [ ] New tests added for new features
- [ ] Lint checks pass (`npm run lint`)

## 📸 Screenshots (if applicable)
<!-- Add screenshots showing before/after changes, especially for UI updates -->

**Before:**
<!-- Screenshot or description of current state -->

**After:**
<!-- Screenshot or description after changes -->

## 📝 Checklist
<!-- Ensure you've completed the following before submitting -->

### Code Quality
- [ ] My code follows the project's style guidelines (JSDoc, no TypeScript)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have not modified `mini-app/css/variables.css` color tokens (brand locked)

### Testing
- [ ] I have tested my changes on iOS Safari (primary target)
- [ ] I have tested my changes on Android Chrome
- [ ] All touch targets are ≥44px (iOS guideline)
- [ ] Changes work correctly in both light and dark Telegram themes
- [ ] No console errors in browser DevTools

### Documentation
- [ ] I have updated the README.md if needed
- [ ] I have updated JSDoc comments for new/modified functions
- [ ] I have updated docs/PROJECT_KNOWLEDGE.md if architecture changed
- [ ] I have added an entry to CHANGELOG.md under "Unreleased"

### Security & Performance
- [ ] No secrets or API keys are hardcoded
- [ ] No new security vulnerabilities introduced
- [ ] Performance impact is acceptable (tested with Lighthouse if UI changes)

## 🔍 Additional Notes
<!-- Any additional information that reviewers should know -->


## 🚀 Deployment Notes
<!-- Special instructions for deploying this change, if any -->
- Database migration required: [ ] Yes / [ ] No
- Environment variable changes: [ ] Yes / [ ] No (if yes, list below)
- Breaking changes: [ ] Yes / [ ] No (if yes, describe migration path)

---

**Reviewer Checklist** (for maintainers)
- [ ] Code review completed
- [ ] Tested on physical device (iOS/Android)
- [ ] Documentation is clear and accurate
- [ ] No merge conflicts
- [ ] CI/CD checks pass
