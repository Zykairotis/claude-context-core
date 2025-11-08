#!/bin/bash
# Helper script to view MCP server logs

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

LOGS_DIR="$(dirname "$0")/logs"
MAIN_LOG="$LOGS_DIR/mcp-server.log"
DEBUG_LOG="$LOGS_DIR/mcp-debug.log"

# Parse arguments
MODE="${1:-tail}"  # tail, full, debug, errors, clean

case "$MODE" in
  tail)
    echo -e "${GREEN}📋 Tailing MCP server logs (Ctrl+C to stop)...${NC}"
    echo -e "${BLUE}File: $MAIN_LOG${NC}"
    echo ""
    tail -f "$MAIN_LOG" 2>/dev/null || echo "Log file not found. Start the MCP server first."
    ;;
    
  debug)
    echo -e "${GREEN}🐛 Tailing DEBUG logs (Ctrl+C to stop)...${NC}"
    echo -e "${BLUE}File: $DEBUG_LOG${NC}"
    echo ""
    tail -f "$DEBUG_LOG" 2>/dev/null || echo "Debug log file not found. Start the MCP server first."
    ;;
    
  errors)
    echo -e "${GREEN}❌ Showing ERROR logs only...${NC}"
    echo ""
    if [ -f "$MAIN_LOG" ]; then
      grep "\[ERROR\]" "$MAIN_LOG" | tail -50
    else
      echo "Log file not found."
    fi
    ;;
    
  full)
    echo -e "${GREEN}📄 Showing full log file...${NC}"
    echo ""
    if [ -f "$MAIN_LOG" ]; then
      cat "$MAIN_LOG"
    else
      echo "Log file not found."
    fi
    ;;
    
  clean)
    echo -e "${YELLOW}🗑️  Cleaning old logs...${NC}"
    rm -f "$MAIN_LOG" "$DEBUG_LOG"
    echo "✅ Logs cleaned. They will be recreated when MCP server starts."
    ;;
    
  search)
    if [ -z "$2" ]; then
      echo "Usage: $0 search <pattern>"
      exit 1
    fi
    echo -e "${GREEN}🔍 Searching for: $2${NC}"
    echo ""
    grep -i "$2" "$MAIN_LOG" | tail -50
    ;;
    
  *)
    echo "Usage: $0 [mode]"
    echo ""
    echo "Modes:"
    echo "  tail       - Tail main log file (default)"
    echo "  debug      - Tail debug log file (errors + debug messages)"
    echo "  errors     - Show only ERROR lines (last 50)"
    echo "  full       - Show full log file"
    echo "  clean      - Delete all log files"
    echo "  search <pattern> - Search for pattern in logs"
    echo ""
    echo "Examples:"
    echo "  $0                          # Tail main logs"
    echo "  $0 debug                    # Tail debug logs"
    echo "  $0 errors                   # Show errors only"
    echo "  $0 search \"Island Architecture\"  # Search logs"
    echo "  $0 clean                    # Clean old logs"
    ;;
esac
