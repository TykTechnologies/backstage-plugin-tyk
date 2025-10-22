# Backstage Tyk Entity Provider - Open Source Preparation

## Project Context
This is a Backstage entity provider plugin for Tyk API Gateway. We are preparing this plugin for open source release under AGPL-3.0 license.

**Main Repository:** https://github.com/TykTechnologies/backstage-tyk-entity-provider
**Related Tyk Projects:**
- Tyk Gateway: https://github.com/TykTechnologies/tyk
- Tyk Analytics: https://github.com/TykTechnologies/tyk-analytics

## Related Repositories Context
If I need context from related Tyk projects, they are available at:
- `~/Work/tyk/` - Main Tyk Gateway repo
- `~/Work/tyk-analytics/` - Tyk Analytics Dashboard

You can reference these with `/add-dir` if needed.

## Open Source Checklist

### Phase 1: Legal & Licensing
- [ ] Verify right to open source (check employment agreements, contracts)
- [ ] Ensure no proprietary dependencies or third-party code conflicts with AGPL
- [ ] Add AGPL-3.0 LICENSE file to repository root
- [ ] Add license headers to source files (optional but recommended)
- [ ] Review and remove any API keys, credentials, or secrets from code
- [ ] Check git history for exposed secrets using `git log -p | grep -i "api[_-]key\|secret\|password\|token"`

### Phase 2: Code Preparation & Security Review
- [ ] Remove or redact sensitive information:
  - Internal URLs (*.tyk.internal, internal.tyktech.com, etc.)
  - Company-specific configs
  - Internal Slack/JIRA references
  - Employee emails or names
- [ ] Search for TODO/FIXME comments referencing internal systems
- [ ] Clean up commented-out code
- [ ] Review code quality and refactor if needed
- [ ] Ensure the project builds and runs correctly
- [ ] Update or create .gitignore file

**Search Patterns to Check:**
- `tyk.internal`
- `tyktech.com` (non-public domains)
- `TODO:` and `FIXME:` comments
- Hardcoded API endpoints
- Internal authentication mechanisms

### Phase 3: Documentation
- [ ] Create comprehensive README.md:
  - Project description and purpose
  - How it integrates with Backstage
  - How it connects to Tyk Gateway/Dashboard
  - Installation instructions
  - Configuration examples
  - Usage examples
  - Requirements/dependencies
  - Build instructions
- [ ] Create CONTRIBUTING.md with:
  - How to contribute
  - Code standards
  - Testing requirements
  - PR process
- [ ] Create CODE_OF_CONDUCT.md (use Contributor Covenant)
- [ ] Document architecture/design decisions
- [ ] Add or update CHANGELOG.md
- [ ] Add inline code documentation where needed

### Phase 4: Repository Setup
- [ ] Verify repository name is appropriate: `backstage-tyk-entity-provider`
- [ ] Write clear repository description
- [ ] Add relevant topics/tags: `backstage`, `backstage-plugin`, `tyk`, `api-gateway`, `entity-provider`
- [ ] Set up issue templates:
  - Bug report template
  - Feature request template
- [ ] Set up pull request template
- [ ] Configure branch protection rules for `main`
- [ ] Set up CI/CD (GitHub Actions for testing, building)
- [ ] Add badges to README:
  - Build status
  - License badge
  - npm version (if applicable)
  - GitHub stars

### Phase 5: Community & Support
- [ ] Decide on communication channels
- [ ] Set up GitHub Discussions or link to community
- [ ] Determine issue/PR handling process
- [ ] Set up automated testing in CI
- [ ] Add status badges to README

### Phase 6: Launch Preparation
- [ ] Final security review
- [ ] Test installation from scratch
- [ ] Prepare announcement (blog post, social media, etc.)
- [ ] Submit to Backstage plugin directory
- [ ] Submit to npm (if not already published)

### Phase 7: Launch
- [ ] Change repository visibility to public (if currently private)
- [ ] Publish to npm registry
- [ ] Announce on:
  - Tyk community channels
  - Backstage Discord/community
  - Twitter, LinkedIn, etc.
- [ ] Submit to backstage.io/plugins

### Phase 8: Post-Launch
- [ ] Monitor and respond to initial issues
- [ ] Keep documentation updated
- [ ] Create roadmap in GitHub Projects or ROADMAP.md
- [ ] Establish release process and versioning strategy
- [ ] Set up automated releases

## Backstage-Specific Context

### Plugin Type
This is a Backstage **entity provider** plugin that:
- Discovers entities from Tyk API Gateway
- Syncs Tyk APIs into Backstage catalog
- Provides entity metadata for Tyk resources

### Key Files to Review
- `src/providers/` - Entity provider implementation
- `package.json` - Dependencies, scripts, metadata
- `config.d.ts` - Configuration schema
- Any example configs or documentation

### Backstage Integration Points
- Uses Backstage entity model
- Integrates with catalog backend
- May use Tyk Dashboard API or Gateway API

## Things to NEVER Include in Open Source Release
- Internal Tyk infrastructure details
- Customer-specific configurations
- Employee personal information
- Internal Slack channels or JIRA boards
- Proprietary Tyk internal tools or APIs
- API keys or authentication tokens (even expired ones)
- Internal monitoring/logging endpoints

## Tyk-Specific Considerations
- Ensure examples use public Tyk documentation
- Reference official Tyk API docs: https://tyk.io/docs/
- Use generic Tyk Gateway/Dashboard URLs in examples
- Make authentication configurable (not hardcoded)

## Commands & Tools

### Search for Sensitive Content
```bash
# Search for potential secrets
git log -p | grep -iE "api[_-]?key|secret|password|token"

# Search for internal URLs
grep -r "tyk\.internal" .
grep -r "tyktech\.com" . --exclude-dir=node_modules

# Find TODOs referencing internal systems
grep -r "TODO.*internal\|TODO.*tyk\|FIXME.*internal" . --exclude-dir=node_modules
```

### Build & Test
```bash
# Install dependencies
yarn install

# Build
yarn build

# Test
yarn test

# Lint
yarn lint
```

## Current Status
**Phase:** Starting open source preparation
**Next Steps:** Begin with Legal & Licensing phase, then move to Code Preparation

## Notes for Claude
- Be thorough in security review - this will be public!
- When searching, check all file types (TypeScript, JavaScript, JSON, YAML, Markdown)
- Always ask before making assumptions about what should be public vs private
- Suggest improvements to make the plugin more useful for the community
- Keep Backstage best practices in mind

