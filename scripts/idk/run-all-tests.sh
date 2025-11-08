#!/bin/bash

# Cognee MCP Integration Test Suite Runner
# Runs all test phases in order and generates a summary

echo "════════════════════════════════════════════════════════════════"
echo "   🧪 Cognee MCP Integration - Complete Test Suite"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall results
TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_TESTS=""

# Function to run a test and track results
run_test() {
  local test_file=$1
  local test_name=$2
  
  echo -e "${YELLOW}Running:${NC} $test_name"
  echo "────────────────────────────────────────────────────"
  
  if node "$test_file" 2>&1 | tee test-output.tmp | grep -E "(Passed|Failed|Success Rate)"; then
    # Extract results from output
    local passed=$(grep -oP '✅ Passed: \K\d+' test-output.tmp | tail -1)
    local failed=$(grep -oP '❌ Failed: \K\d+' test-output.tmp | tail -1)
    
    # Default to 0 if not found
    passed=${passed:-0}
    failed=${failed:-0}
    
    TOTAL_PASSED=$((TOTAL_PASSED + passed))
    TOTAL_FAILED=$((TOTAL_FAILED + failed))
    
    if [ "$failed" -gt 0 ]; then
      FAILED_TESTS="$FAILED_TESTS\n  ❌ $test_name: $failed failures"
      echo -e "${RED}❌ $test_name: $passed passed, $failed failed${NC}"
    else
      echo -e "${GREEN}✅ $test_name: All $passed tests passed${NC}"
    fi
  else
    echo -e "${RED}❌ $test_name: Test execution failed${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
    FAILED_TESTS="$FAILED_TESTS\n  ❌ $test_name: Execution error"
  fi
  
  rm -f test-output.tmp
  echo ""
}

# Check if all test files exist
echo "Checking test files..."
for phase in 02 03 04 05; do
  if [ ! -f "test/cognee-phase$phase.test.js" ]; then
    echo -e "${RED}Missing: test/cognee-phase$phase.test.js${NC}"
    exit 1
  fi
done

if [ ! -f "test/cognee-integration.test.js" ]; then
  echo -e "${RED}Missing: test/cognee-integration.test.js${NC}"
  exit 1
fi

if [ ! -f "test/cognee-validation.test.js" ]; then
  echo -e "${RED}Missing: test/cognee-validation.test.js${NC}"
  exit 1
fi

echo "All test files found ✅"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Run tests in order
run_test "test/cognee-phase02.test.js" "Phase 02: Action Analysis & Tools"
run_test "test/cognee-phase03.test.js" "Phase 03: Plan Generation"
run_test "test/cognee-phase04.test.js" "Phase 04: Execution Monitoring"
run_test "test/cognee-phase05.test.js" "Phase 05: Dynamic Replanning"
run_test "test/cognee-integration.test.js" "Phase 06: Integration Tests"
run_test "test/cognee-validation.test.js" "Phase 06: Validation Tests"

# Generate final report
echo "════════════════════════════════════════════════════════════════"
echo "   📊 FINAL TEST REPORT"
echo "════════════════════════════════════════════════════════════════"
echo ""

TOTAL=$((TOTAL_PASSED + TOTAL_FAILED))
if [ "$TOTAL" -gt 0 ]; then
  SUCCESS_RATE=$(echo "scale=2; $TOTAL_PASSED * 100 / $TOTAL" | bc)
else
  SUCCESS_RATE=0
fi

echo -e "✅ Total Passed: ${GREEN}$TOTAL_PASSED${NC}"
echo -e "❌ Total Failed: ${RED}$TOTAL_FAILED${NC}"
echo -e "📈 Success Rate: ${YELLOW}$SUCCESS_RATE%${NC}"
echo ""

if [ "$TOTAL_FAILED" -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED! System is production ready.${NC}"
  echo ""
  echo "✨ Validated Components:"
  echo "  • Enhanced helpers & retry logic"
  echo "  • GOAP planner with A* pathfinding"
  echo "  • Action library (20+ actions)"
  echo "  • OODA loop monitoring"
  echo "  • Circuit breakers"
  echo "  • Dynamic replanning"
  echo "  • Learning system"
  echo "  • Full integration"
  echo "  • Schema validation"
  echo "  • Performance targets"
  exit 0
else
  echo -e "${RED}⚠️  Some tests failed:${NC}"
  echo -e "$FAILED_TESTS"
  echo ""
  echo "Please review and fix the failing tests."
  exit 1
fi
