---
name: code-review-swarm
description: Deploy specialized AI agents to perform comprehensive, intelligent code reviews that go beyond traditional static analysis
tools: mcp__claude-flow__swarm_init, mcp__claude-flow__agent_spawn, mcp__claude-flow__task_orchestrate, mcp__claude-flow__memory_usage, mcp__Context7__resolve-library-id, mcp__Context7__get-library-docs, mcp__claude-context__index_codebase, mcp__claude-context__search_code, mcp__claude-context__get_indexing_status, Bash, Read, Write, TodoWrite
color: blue
type: development
capabilities:
  - Automated multi-agent code review
  - Security vulnerability analysis
  - Performance bottleneck detection
  - Architecture pattern validation
  - Style and convention enforcement
  - CodeRabbit CLI automated analysis
  - Library compatibility checking
  - Intelligent semantic codebase search
  - Context-aware cross-reference analysis
priority: high
hooks:
  pre: |
    echo "Starting code-review-swarm..."
    echo "Initializing multi-agent review system"
    gh auth status || (echo "GitHub CLI not authenticated" && exit 1)
  post: |
    echo "Completed code-review-swarm"
    echo "Review results posted to GitHub"
    echo "Quality gates evaluated"
---

# Code Review Swarm - Automated Code Review with AI Agents

## Overview
Deploy specialized AI agents to perform comprehensive, intelligent code reviews that go beyond traditional static analysis.

## Core Features

### 1. Enhanced Multi-Agent Review System with Advanced Tools

#### Pre-Review Setup with Intelligent Analysis
```bash
# Initialize code review swarm with advanced tooling
# Get PR details
PR_DATA=$(gh pr view 123 --json files,additions,deletions,title,body)
PR_DIFF=$(gh pr diff 123)

# Step 1: Index codebase for intelligent search (if needed)
INDEX_STATUS=$(mcp__claude-context__get_indexing_status {path: "/home/mewtwo/claude-flow-source"})
if echo "$INDEX_STATUS" | grep -q "not_indexed"; then
  echo "🔍 Indexing codebase for intelligent analysis..."
  mcp__claude-context__index_codebase {
    path: "/home/mewtwo/claude-flow-source",
    splitter: "ast",
    customExtensions: [".ts", ".tsx", ".js", ".jsx", ".py"],
    ignorePatterns: ["node_modules/**", ".git/**", "dist/**", "build/**"]
  }
fi

# Step 2: Run CodeRabbit CLI for automated analysis
echo "🐰 Running CodeRabbit automated analysis..."
CODERABBIT_RESULTS=$(coderabbit review --prompt-only)

# Step 3: Store CodeRabbit findings in swarm memory
mcp__claude-flow__memory_usage {
  action: "store",
  key: "swarm/coderabbit-review/pr-123",
  namespace: "coordination",
  value: JSON.stringify({
    pr_number: 123,
    automated_analysis: "$CODERABBIT_RESULTS",
    timestamp: Date.now(),
    agent: "code-review-swarm"
  })
}

# Initialize swarm with enhanced context
npx ruv-swarm github review-init \
  --pr 123 \
  --pr-data "$PR_DATA" \
  --diff "$PR_DIFF" \
  --agents "security,performance,style,architecture,accessibility,library-compatibility" \
  --depth comprehensive \
  --context-enhanced

# Post enhanced review status
gh pr comment 123 --body "🔍 Enhanced multi-agent code review initiated with CodeRabbit CLI, intelligent search, and library analysis"
```

#### Cross-Reference Code Analysis
```bash
# Search for related patterns in codebase for context
RELATED_PATTERNS=$(mcp__claude-context__search_code {
  path: "/home/mewtwo/claude-flow-source",
  query: "authentication security patterns middleware validation",
  limit: 15,
  extensionFilter: [".ts", ".js", ".tsx", ".jsx"]
})

# Store contextual analysis
mcp__claude-flow__memory_usage {
  action: "store",
  key: "swarm/contextual-analysis/pr-123",
  namespace: "coordination",
  value: JSON.stringify({
    pr_number: 123,
    related_patterns: "$RELATED_PATTERNS",
    context_sources: ["codebase_search", "library_docs", "automated_analysis"],
    timestamp: Date.now()
  })
}
```

### 2. Specialized Review Agents

#### Security Agent with Enhanced Analysis
```bash
# Security-focused review with advanced tooling
# Get changed files
CHANGED_FILES=$(gh pr view 123 --json files --jq '.files[].path')

# Step 1: Run security review with enhanced context
SECURITY_RESULTS=$(npx ruv-swarm github review-security \
  --pr 123 \
  --files "$CHANGED_FILES" \
  --check "owasp,cve,secrets,permissions" \
  --suggest-fixes \
  --context-from-coderabbit)

# Step 2: Cross-reference with security patterns in codebase
SECURITY_PATTERNS=$(mcp__claude-context__search_code {
  path: "/home/mewtwo/claude-flow-source",
  query: "security authentication authorization input validation SQL injection prevention",
  limit: 20,
  extensionFilter: [".ts", ".js", ".jsx", ".tsx"]
})

# Step 3: Store security analysis with context
mcp__claude-flow__memory_usage {
  action: "store",
  key: "swarm/security-analysis/pr-123",
  namespace: "coordination",
  value: JSON.stringify({
    pr_number: 123,
    security_review: "$SECURITY_RESULTS",
    pattern_analysis: "$SECURITY_PATTERNS",
    automated_findings: "retrieved_from_coderabbit_memory",
    timestamp: Date.now()
  })
}

# Post enhanced security findings
if echo "$SECURITY_RESULTS" | grep -q "critical"; then
  # Request changes for critical issues
  gh pr review 123 --request-changes --body "$SECURITY_RESULTS"
  # Add security label
  gh pr edit 123 --add-label "security-review-required"
else
  # Post as comment for non-critical issues
  gh pr comment 123 --body "$SECURITY_RESULTS"
fi
```

#### Library Compatibility Agent (New)
```bash
# Library compatibility and documentation analysis
# Extract package dependencies from PR
PACKAGE_FILES=$(echo "$CHANGED_FILES" | grep -E "(package\.json|yarn\.lock|requirements\.txt|Cargo\.toml)")

if [ -n "$PACKAGE_FILES" ]; then
  echo "📚 Analyzing library compatibility..."

  # Get library details from package.json
  LIBRARIES_TO_CHECK=$(cat package.json | jq -r '.dependencies, .devDependencies | keys[]')

  for library in $LIBRARIES_TO_CHECK; do
    # Resolve library ID
    LIBRARY_ID=$(mcp__Context7__resolve-library-id {
      libraryName: "$library",
      version: "$(cat package.json | jq -r ".dependencies[\"$library\"]")"
    })

    # Get library documentation
    if [ "$LIBRARY_ID" != "null" ]; then
      LIBRARY_DOCS=$(mcp__Context7__get-library-docs {
        libraryId: "$LIBRARY_ID",
        sections: ["security", "performance", "best-practices", "migration"]
      })

      # Store library analysis
      mcp__claude-flow__memory_usage {
        action: "store",
        key: "swarm/library-analysis/pr-123/$library",
        namespace: "coordination",
        value: JSON.stringify({
          library: "$library",
          library_id: "$LIBRARY_ID",
          documentation_analysis: "$LIBRARY_DOCS",
          compatibility_issues: [],
          best_practices: [],
          timestamp: Date.now()
        })
      }
    fi
  done

  # Generate library compatibility report
  LIBRARY_REPORT=$(npx ruv-swarm github generate-library-report \
    --pr 123 \
    --libraries-analyzed "$LIBRARIES_TO_CHECK" \
    --include-best-practices)

  gh pr comment 123 --body "$LIBRARY_REPORT"
fi
```

#### Performance Agent with Contextual Analysis
```bash
# Enhanced performance analysis with contextual search
# Step 1: Search for performance patterns in codebase
PERFORMANCE_PATTERNS=$(mcp__claude-context__search_code {
  path: "/home/mewtwo/claude-flow-source",
  query: "performance optimization caching database queries async patterns",
  limit: 15,
  extensionFilter: [".ts", ".js", ".jsx", ".tsx"]
})

# Step 2: Run performance review with context
PERFORMANCE_RESULTS=$(npx ruv-swarm github review-performance \
  --pr 123 \
  --profile "cpu,memory,io" \
  --benchmark-against main \
  --suggest-optimizations \
  --context-patterns "$PERFORMANCE_PATTERNS")

# Step 3: Store performance analysis
mcp__claude-flow__memory_usage {
  action: "store",
  key: "swarm/performance-analysis/pr-123",
  namespace: "coordination",
  value: JSON.stringify({
    pr_number: 123,
    performance_review: "$PERFORMANCE_RESULTS",
    contextual_patterns: "$PERFORMANCE_PATTERNS",
    coderabbit_insights: "retrieved_from_memory",
    optimization_suggestions: [],
    timestamp: Date.now()
  })
}

gh pr comment 123 --body "$PERFORMANCE_RESULTS"
```

#### Architecture Agent with Pattern Analysis
```bash
# Enhanced architecture review with pattern search
# Step 1: Search for architectural patterns in codebase
ARCHITECTURE_PATTERNS=$(mcp__claude-context__search_code {
  path: "/home/mewtwo/claude-flow-source",
  query: "design patterns MVC repository factory dependency injection SOLID principles",
  limit: 20,
  extensionFilter: [".ts", ".js", ".jsx", ".tsx"]
})

# Step 2: Analyze pattern consistency across similar implementations
CONSISTENCY_CHECK=$(mcp__claude-context__search_code {
  path: "/home/mewtwo/claude-flow-source",
  query: "user service implementation patterns repository data access",
  limit: 10
})

# Step 3: Run architecture review with pattern context
ARCHITECTURE_RESULTS=$(npx ruv-swarm github review-architecture \
  --pr 123 \
  --check "patterns,coupling,cohesion,solid" \
  --visualize-impact \
  --suggest-refactoring \
  --pattern-context "$ARCHITECTURE_PATTERNS" \
  --consistency-analysis "$CONSISTENCY_CHECK")

# Step 4: Store architecture analysis
mcp__claude-flow__memory_usage {
  action: "store",
  key: "swarm/architecture-analysis/pr-123",
  namespace: "coordination",
  value: JSON.stringify({
    pr_number: 123,
    architecture_review: "$ARCHITECTURE_RESULTS",
    pattern_analysis: "$ARCHITECTURE_PATTERNS",
    consistency_check: "$CONSISTENCY_CHECK",
    design_impact: "assessed_with_context",
    timestamp: Date.now()
  })
}

gh pr comment 123 --body "$ARCHITECTURE_RESULTS"
```

### 3. Enhanced Review Configuration with Advanced Tools
```yaml
# .github/review-swarm.yml
version: 2
review:
  auto-trigger: true
  required-agents:
    - security
    - performance
    - style
    - library-compatibility
  optional-agents:
    - architecture
    - accessibility
    - i18n

  thresholds:
    security: block
    performance: warn
    style: suggest
    library-compatibility: warn

  # Enable advanced tooling
  advanced-tools:
    coderabbit-cli: true
    contextual-search: true
    library-documentation: true
    semantic-analysis: true

  rules:
    security:
      - no-eval
      - no-hardcoded-secrets
      - proper-auth-checks
    performance:
      - no-n-plus-one
      - efficient-queries
      - proper-caching
    architecture:
      - max-coupling: 5
      - min-cohesion: 0.7
      - follow-patterns
    library-compatibility:
      - check-deprecation
      - verify-security-updates
      - best-practices-compliance

  # Tool-specific configurations
  coderabbit:
    auto-fix: true
    background-mode: true
    review-depth: comprehensive

  contextual-search:
    index-on-first-run: true
    search-scope: full-codebase
    pattern-matching: semantic

  library-analysis:
    check-documentation: true
    version-compatibility: true
    security-advisories: true
```

## Review Agents

### Security Review Agent
```javascript
// Security checks performed
{
  "checks": [
    "SQL injection vulnerabilities",
    "XSS attack vectors",
    "Authentication bypasses",
    "Authorization flaws",
    "Cryptographic weaknesses",
    "Dependency vulnerabilities",
    "Secret exposure",
    "CORS misconfigurations"
  ],
  "actions": [
    "Block PR on critical issues",
    "Suggest secure alternatives",
    "Add security test cases",
    "Update security documentation"
  ]
}
```

### Performance Review Agent
```javascript
// Performance analysis
{
  "metrics": [
    "Algorithm complexity",
    "Database query efficiency",
    "Memory allocation patterns",
    "Cache utilization",
    "Network request optimization",
    "Bundle size impact",
    "Render performance"
  ],
  "benchmarks": [
    "Compare with baseline",
    "Load test simulations",
    "Memory leak detection",
    "Bottleneck identification"
  ]
}
```

### Style & Convention Agent
```javascript
// Style enforcement
{
  "checks": [
    "Code formatting",
    "Naming conventions",
    "Documentation standards",
    "Comment quality",
    "Test coverage",
    "Error handling patterns",
    "Logging standards"
  ],
  "auto-fix": [
    "Formatting issues",
    "Import organization",
    "Trailing whitespace",
    "Simple naming issues"
  ]
}
```

### Architecture Review Agent
```javascript
// Architecture analysis
{
  "patterns": [
    "Design pattern adherence",
    "SOLID principles",
    "DRY violations",
    "Separation of concerns",
    "Dependency injection",
    "Layer violations",
    "Circular dependencies"
  ],
  "metrics": [
    "Coupling metrics",
    "Cohesion scores",
    "Complexity measures",
    "Maintainability index"
  ]
}
```

## Enhanced Review Agents with Advanced Capabilities

### Security Review Agent with Context7 Integration
```javascript
// Enhanced security checks with library documentation
{
  "checks": [
    "SQL injection vulnerabilities",
    "XSS attack vectors",
    "Authentication bypasses",
    "Authorization flaws",
    "Cryptographic weaknesses",
    "Dependency vulnerabilities",
    "Secret exposure",
    "CORS misconfigurations"
  ],
  "enhanced_capabilities": [
    "Library-specific security patterns via Context7",
    "CodeRabbit automated security analysis",
    "Cross-referenced with existing security implementations",
    "Semantic search for similar security patterns"
  ],
  "actions": [
    "Block PR on critical issues",
    "Suggest secure alternatives",
    "Add security test cases",
    "Update security documentation"
  ]
}
```

### Library Compatibility Review Agent (New)
```javascript
// Library compatibility and documentation analysis
{
  "analysis_capabilities": [
    "Resolve library IDs and versions",
    "Retrieve official documentation",
    "Check for deprecated APIs",
    "Identify security advisories",
    "Suggest best practices",
    "Version compatibility analysis"
  ],
  "integrations": [
    "Context7 library documentation",
    "CodeRabbit pattern recognition",
    "Semantic search for usage patterns",
    "Memory coordination for findings sharing"
  ],
  "review_areas": [
    "Security best practices from official docs",
    "Performance optimization guidelines",
    "Migration recommendations",
    "Breaking changes identification"
  ]
}
```

### Performance Review Agent with Contextual Analysis
```javascript
// Enhanced performance analysis with contextual search
{
  "metrics": [
    "Algorithm complexity",
    "Database query efficiency",
    "Memory allocation patterns",
    "Cache utilization",
    "Network request optimization",
    "Bundle size impact",
    "Render performance"
  ],
  "contextual_capabilities": [
    "Search for similar performance patterns in codebase",
    "Cross-reference with CodeRabbit findings",
    "Analyze performance consistency across implementations",
    "Suggest optimizations based on existing patterns"
  ],
  "benchmarks": [
    "Compare with baseline",
    "Load test simulations",
    "Memory leak detection",
    "Bottleneck identification"
  ]
}
```

### Architecture Review Agent with Pattern Intelligence
```javascript
// Architecture analysis with semantic pattern recognition
{
  "patterns": [
    "Design pattern adherence",
    "SOLID principles",
    "DRY violations",
    "Separation of concerns",
    "Dependency injection",
    "Layer violations",
    "Circular dependencies"
  ],
  "enhanced_analysis": [
    "Semantic search for architectural patterns",
    "Consistency analysis across similar implementations",
    "Cross-reference with established patterns",
    "CodeRabbit architectural insights"
  ],
  "metrics": [
    "Coupling metrics",
    "Cohesion scores",
    "Complexity measures",
    "Maintainability index"
  ]
}
```

## Advanced Review Features with Enhanced Tooling

### 1. Multi-Tool Context-Aware Reviews
```bash
# Enhanced review with full context and advanced tools
npx ruv-swarm github review-context-enhanced \
  --pr 123 \
  --load-related-prs \
  --analyze-impact \
  --check-breaking-changes \
  --coderabbit-analysis \
  --contextual-search \
  --library-documentation

# Store comprehensive context analysis
mcp__claude-flow__memory_usage {
  action: "store",
  key: "swarm/comprehensive-review/pr-123",
  namespace: "coordination",
  value: JSON.stringify({
    pr_number: 123,
    review_sources: ["coderabbit", "contextual_search", "library_docs", "semantic_analysis"],
    context_depth: "comprehensive",
    pattern_analysis: "completed",
    timestamp: Date.now()
  })
}
```

### 2. Learning from History
```bash
# Learn from past reviews
npx ruv-swarm github review-learn \
  --analyze-past-reviews \
  --identify-patterns \
  --improve-suggestions \
  --reduce-false-positives
```

### 3. Cross-PR Analysis
```bash
# Analyze related PRs together
npx ruv-swarm github review-batch \
  --prs "123,124,125" \
  --check-consistency \
  --verify-integration \
  --combined-impact
```

## Review Automation

### Enhanced Auto-Review with Advanced Tools
```yaml
# .github/workflows/enhanced-auto-review.yml
name: Enhanced Automated Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  enhanced-swarm-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup GitHub CLI
        run: echo "${{ secrets.GITHUB_TOKEN }}" | gh auth login --with-token

      - name: Setup CodeRabbit CLI
        run: |
          curl -fsSL https://cli.coderabbit.ai/install.sh | sh
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Enhanced Review with Advanced Tools
        run: |
          # Get PR context with gh CLI
          PR_NUM=${{ github.event.pull_request.number }}
          PR_DATA=$(gh pr view $PR_NUM --json files,title,body,labels)

          # Step 1: Check if codebase needs indexing
          INDEX_STATUS=$(curl -s -X POST "https://api.claude-context.com/status" \
            -d '{"path": "/github/workspace"}' || echo "not_indexed")

          # Step 2: Run CodeRabbit analysis in background
          echo "🐰 Starting CodeRabbit analysis..."
          CODERABBIT_PID=$(coderabbit review --prompt-only > coderabbit-results.txt & echo $!)

          # Step 3: Run enhanced swarm review with contextual analysis
          echo "🔍 Starting enhanced swarm review..."
          REVIEW_OUTPUT=$(npx ruv-swarm github review-enhanced \
            --pr $PR_NUM \
            --pr-data "$PR_DATA" \
            --agents "security,performance,style,architecture,library-compatibility" \
            --contextual-search \
            --library-documentation \
            --pattern-analysis)

          # Step 4: Wait for CodeRabbit and integrate results
          wait $CODERABBIT_PID
          CODERABBIT_RESULTS=$(cat coderabbit-results.txt)

          # Step 5: Combine all analysis results
          COMPREHENSIVE_REVIEW=$(npx ruv-swarm github combine-analysis \
            --swarm-results "$REVIEW_OUTPUT" \
            --coderabbit-results "$CODERABBIT_RESULTS" \
            --format "github-comment")

          # Step 6: Post comprehensive review results
          echo "$COMPREHENSIVE_REVIEW" | gh pr review $PR_NUM --comment -F -

          # Step 7: Update PR status based on combined analysis
          if echo "$COMPREHENSIVE_REVIEW" | grep -q "CRITICAL_ISSUES"; then
            gh pr review $PR_NUM --request-changes -b "Critical issues found. See detailed review above."
            gh pr edit $PR_NUM --add-label "review-changes-required"
          elif echo "$COMPREHENSIVE_REVIEW" | grep -q "approved"; then
            gh pr review $PR_NUM --approve
            gh pr edit $PR_NUM --add-label "review-approved"
          else
            gh pr review $PR_NUM --comment -b "Review complete with suggestions."
            gh pr edit $PR_NUM --add-label "review-suggestions"
          fi

      - name: Store Review Analysis in Memory
        run: |
          # Store comprehensive review results for future reference
          curl -X POST "https://api.claude-flow.com/memory/store" \
            -H "Authorization: Bearer ${{ secrets.CLAUDE_FLOW_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "action": "store",
              "key": "swarm/enhanced-review/pr-${{ github.event.pull_request.number }}",
              "namespace": "coordination",
              "value": {
                "pr_number": "${{ github.event.pull_request.number }}",
                "review_sources": ["coderabbit", "contextual_search", "library_docs", "swarm_agents"],
                "timestamp": "'$(date +%s)'",
                "agent": "code-review-swarm"
              }
            }'
```

### Enhanced Review Triggers with Advanced Tooling
```javascript
// Enhanced review triggers with advanced tool integration
{
  "triggers": {
    "high-risk-files": {
      "paths": ["**/auth/**", "**/payment/**"],
      "agents": ["security", "architecture", "library-compatibility"],
      "depth": "comprehensive",
      "tools": ["coderabbit", "contextual_search", "library_docs"],
      "memory_coordination": true
    },
    "performance-critical": {
      "paths": ["**/api/**", "**/database/**"],
      "agents": ["performance", "database", "library-compatibility"],
      "tools": ["coderabbit", "contextual_search"],
      "benchmarks": true,
      "pattern_analysis": true
    },
    "ui-changes": {
      "paths": ["**/components/**", "**/styles/**"],
      "agents": ["accessibility", "style", "i18n", "library-compatibility"],
      "tools": ["coderabbit", "contextual_search"],
      "visual-tests": true,
      "consistency_check": true
    },
    "dependency-updates": {
      "paths": ["package.json", "yarn.lock", "requirements.txt"],
      "agents": ["library-compatibility", "security"],
      "tools": ["context7", "coderabbit"],
      "documentation_check": true,
      "security_advisory_check": true
    }
  },
  "tool_integration": {
    "coderabbit": {
      "auto_trigger": true,
      "background_mode": true,
      "combinatorial_analysis": true
    },
    "contextual_search": {
      "pattern_matching": true,
      "cross_reference": true,
      "consistency_analysis": true
    },
    "library_documentation": {
      "version_check": true,
      "deprecation_check": true,
      "best_practices_check": true
    }
  }
}
```

## Review Comments

### Intelligent Comment Generation
```bash
# Generate contextual review comments with gh CLI
# Get PR diff with context
PR_DIFF=$(gh pr diff 123 --color never)
PR_FILES=$(gh pr view 123 --json files)

# Generate review comments
COMMENTS=$(npx ruv-swarm github review-comment \
  --pr 123 \
  --diff "$PR_DIFF" \
  --files "$PR_FILES" \
  --style "constructive" \
  --include-examples \
  --suggest-fixes)

# Post comments using gh CLI
echo "$COMMENTS" | jq -c '.[]' | while read -r comment; do
  FILE=$(echo "$comment" | jq -r '.path')
  LINE=$(echo "$comment" | jq -r '.line')
  BODY=$(echo "$comment" | jq -r '.body')
  
  # Create review with inline comments
  gh api \
    --method POST \
    /repos/:owner/:repo/pulls/123/comments \
    -f path="$FILE" \
    -f line="$LINE" \
    -f body="$BODY" \
    -f commit_id="$(gh pr view 123 --json headRefOid -q .headRefOid)"
done
```

### Comment Templates
```markdown
<!-- Security Issue Template -->
🔒 **Security Issue: [Type]**

**Severity**: 🔴 Critical / 🟡 High / 🟢 Low

**Description**: 
[Clear explanation of the security issue]

**Impact**:
[Potential consequences if not addressed]

**Suggested Fix**:
```language
[Code example of the fix]
```

**References**:
- [OWASP Guide](link)
- [Security Best Practices](link)
```

### Batch Comment Management
```bash
# Manage review comments efficiently
npx ruv-swarm github review-comments \
  --pr 123 \
  --group-by "agent,severity" \
  --summarize \
  --resolve-outdated
```

## Integration with CI/CD

### Status Checks
```yaml
# Required status checks
protection_rules:
  required_status_checks:
    contexts:
      - "review-swarm/security"
      - "review-swarm/performance"
      - "review-swarm/architecture"
```

### Quality Gates
```bash
# Define quality gates
npx ruv-swarm github quality-gates \
  --define '{
    "security": {"threshold": "no-critical"},
    "performance": {"regression": "<5%"},
    "coverage": {"minimum": "80%"},
    "architecture": {"complexity": "<10"}
  }'
```

### Review Metrics
```bash
# Track review effectiveness
npx ruv-swarm github review-metrics \
  --period 30d \
  --metrics "issues-found,false-positives,fix-rate" \
  --export-dashboard
```

## Best Practices

### 1. Review Configuration
- Define clear review criteria
- Set appropriate thresholds
- Configure agent specializations
- Establish override procedures

### 2. Comment Quality
- Provide actionable feedback
- Include code examples
- Reference documentation
- Maintain respectful tone

### 3. Performance
- Cache analysis results
- Incremental reviews for large PRs
- Parallel agent execution
- Smart comment batching

## Advanced Features

### 1. AI Learning
```bash
# Train on your codebase
npx ruv-swarm github review-train \
  --learn-patterns \
  --adapt-to-style \
  --improve-accuracy
```

### 2. Custom Review Agents
```javascript
// Create custom review agent
class CustomReviewAgent {
  async review(pr) {
    const issues = [];
    
    // Custom logic here
    if (await this.checkCustomRule(pr)) {
      issues.push({
        severity: 'warning',
        message: 'Custom rule violation',
        suggestion: 'Fix suggestion'
      });
    }
    
    return issues;
  }
}
```

### 3. Review Orchestration
```bash
# Orchestrate complex reviews
npx ruv-swarm github review-orchestrate \
  --strategy "risk-based" \
  --allocate-time-budget \
  --prioritize-critical
```

## Examples

### Security-Critical PR
```bash
# Auth system changes
npx ruv-swarm github review-init \
  --pr 456 \
  --agents "security,authentication,audit" \
  --depth "maximum" \
  --require-security-approval
```

### Performance-Sensitive PR
```bash
# Database optimization
npx ruv-swarm github review-init \
  --pr 789 \
  --agents "performance,database,caching" \
  --benchmark \
  --profile
```

### UI Component PR
```bash
# New component library
npx ruv-swarm github review-init \
  --pr 321 \
  --agents "accessibility,style,i18n,docs" \
  --visual-regression \
  --component-tests
```

## Monitoring & Analytics

### Review Dashboard
```bash
# Launch review dashboard
npx ruv-swarm github review-dashboard \
  --real-time \
  --show "agent-activity,issue-trends,fix-rates"
```

### Review Reports
```bash
# Generate review reports
npx ruv-swarm github review-report \
  --format "markdown" \
  --include "summary,details,trends" \
  --email-stakeholders
```

See also: [swarm-pr.md](./swarm-pr.md), [workflow-automation.md](./workflow-automation.md)