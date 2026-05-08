#!/bin/bash
# Quick reference for Test Agent Creator operations
# Run as: bash tests/agent-operations.sh <command>

set -e

# Configuration
MC_URL="${MC_URL:-http://localhost:3000}"
MC_API_KEY="${MC_API_KEY:-test-api-key-e2e-12345}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATOR_SCRIPT="$SCRIPT_DIR/create_test_agent.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}═════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Commands
cmd_single() {
    local name="${1:-test-agent-$(date +%s)}"
    local role="${2:-tester}"
    print_header "Creating Single Agent"
    echo "Name: $name"
    echo "Role: $role"
    echo ""
    python "$CREATOR_SCRIPT" --name "$name" --role "$role"
}

cmd_batch() {
    local count="${1:-5}"
    local prefix="${2:-test-batch}"
    print_header "Creating Batch Agents"
    echo "Count:  $count"
    echo "Prefix: $prefix"
    echo ""
    python "$CREATOR_SCRIPT" --batch "$count" --prefix "$prefix"
}

cmd_batch_no_souls() {
    local count="${1:-10}"
    local prefix="${2:-test-quick}"
    print_header "Creating Batch Agents (No Souls)"
    echo "Count:  $count"
    echo "Prefix: $prefix"
    echo ""
    python "$CREATOR_SCRIPT" --batch "$count" --prefix "$prefix" --no-souls
}

cmd_developer() {
    local name="${1:-dev-agent-$(date +%s)}"
    print_header "Creating Developer Agent"
    echo "Name: $name"
    echo ""
    python "$CREATOR_SCRIPT" --name "$name" --role developer --template developer
}

cmd_reviewer() {
    local name="${1:-reviewer-$(date +%s)}"
    print_header "Creating Reviewer Agent"
    echo "Name: $name"
    echo ""
    python "$CREATOR_SCRIPT" --name "$name" --role tester --template reviewer
}

cmd_coordinator() {
    local name="${1:-coordinator-$(date +%s)}"
    print_header "Creating Coordinator Agent"
    echo "Name: $name"
    echo ""
    python "$CREATOR_SCRIPT" --name "$name" --role coordinator --template coordinator
}

cmd_with_soul() {
    local name="${1:-soul-agent-$(date +%s)}"
    local soul="${2:-analyst}"
    print_header "Creating Agent with Soul"
    echo "Name: $name"
    echo "Soul: $soul"
    echo ""
    python "$CREATOR_SCRIPT" --name "$name" --role tester --soul "$soul"
}

cmd_list() {
    print_header "Listing All Agents"
    python "$CREATOR_SCRIPT" --list
}

cmd_load_test() {
    local count="${1:-50}"
    print_header "Load Test: Creating $count Agents"
    echo "This may take a moment..."
    echo ""
    python "$CREATOR_SCRIPT" --batch "$count" --prefix "load-test-$(date +%s)" --no-souls
}

cmd_stress_test() {
    local count="${1:-100}"
    print_header "Stress Test: Creating $count Agents"
    echo "WARNING: This will create many agents!"
    echo "Count: $count"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python "$CREATOR_SCRIPT" --batch "$count" --prefix "stress-test-$(date +%s)" --no-souls
    else
        print_info "Cancelled"
    fi
}

cmd_cleanup() {
    local prefix="${1:-test-}"
    print_header "Cleanup: Deleting Agents with Prefix '$prefix'"
    python "$CREATOR_SCRIPT" --cleanup "$prefix"
}

cmd_cleanup_batch() {
    print_header "Cleanup: Deleting All Test Batches"
    echo "This will delete agents with these prefixes:"
    echo "  - test-batch-*"
    echo "  - test-quick-*"
    echo "  - load-test-*"
    echo "  - stress-test-*"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        python "$CREATOR_SCRIPT" --cleanup "test-batch" 2>/dev/null || true
        python "$CREATOR_SCRIPT" --cleanup "test-quick" 2>/dev/null || true
        python "$CREATOR_SCRIPT" --cleanup "load-test" 2>/dev/null || true
        python "$CREATOR_SCRIPT" --cleanup "stress-test" 2>/dev/null || true
        print_success "Cleanup complete"
    else
        print_info "Cancelled"
    fi
}

cmd_test_scenario() {
    print_header "Setup: Multi-Agent Test Scenario"
    echo "Creating a complete testing scenario..."
    echo ""
    
    # Create coordinator
    print_info "Creating coordinator..."
    COORD=$(python "$CREATOR_SCRIPT" --name "coordinator-test-$(date +%s)" --role coordinator --template coordinator 2>&1 | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
    
    # Create developers
    for i in {1..2}; do
        print_info "Creating developer $i..."
        python "$CREATOR_SCRIPT" --name "dev-test-$i-$(date +%s)" --role developer --template developer --soul analyst > /dev/null
    done
    
    # Create reviewers
    for i in {1..2}; do
        print_info "Creating reviewer $i..."
        python "$CREATOR_SCRIPT" --name "reviewer-test-$i-$(date +%s)" --role tester --template reviewer --soul strict > /dev/null
    done
    
    echo ""
    print_success "Multi-agent scenario created!"
    echo ""
    print_info "Agents created:"
    python "$CREATOR_SCRIPT" --list | grep -E "coordinator-test|dev-test|reviewer-test" || echo "  (No agents found matching pattern)"
}

cmd_help() {
    cat << 'EOF'
Test Agent Creator - Quick Reference
═════════════════════════════════════════

USAGE
    bash tests/agent-operations.sh <command> [options]

COMMANDS
    single [name] [role]           Create a single test agent
    batch [count] [prefix]         Create N agents with random souls
    batch-quick [count] [prefix]   Create N agents (no souls, faster)
    
    developer [name]               Create a developer agent
    reviewer [name]                Create a reviewer agent
    coordinator [name]             Create a coordinator agent
    with-soul [name] [soul]        Create agent with specific soul
    
    list                           List all agents
    
    load-test [count]              Load test with N agents (default: 50)
    stress-test [count]            Stress test with N agents (default: 100)
    scenario                       Create multi-agent test scenario
    
    cleanup [prefix]               Delete agents with prefix
    cleanup-all                    Delete all test batches
    
    help                           Show this help message
    version                        Show version info

ENVIRONMENT VARIABLES
    MC_URL                         Mission Control URL (default: http://localhost:3000)
    MC_API_KEY                     API key (default: test-api-key-e2e-12345)

EXAMPLES
    # Create a single developer agent
    bash tests/agent-operations.sh developer
    
    # Create 10 quick agents for load testing
    bash tests/agent-operations.sh batch-quick 10 load-test
    
    # Create a complete test scenario
    bash tests/agent-operations.sh scenario
    
    # List all agents
    bash tests/agent-operations.sh list
    
    # Clean up all test batches
    bash tests/agent-operations.sh cleanup-all

SOULS
    Available: analyst, creative, strict, helper

TEMPLATES
    Available: developer, reviewer, operator, coordinator

COMMON WORKFLOWS
    
    1. Development Testing
       bash tests/agent-operations.sh developer my-dev
       bash tests/agent-operations.sh reviewer my-reviewer
       bash tests/agent-operations.sh cleanup my-
    
    2. Load Testing
       bash tests/agent-operations.sh batch-quick 100 load-test
       # Run your tests...
       bash tests/agent-operations.sh cleanup load-test
    
    3. Multi-Agent Scenario
       bash tests/agent-operations.sh scenario
       # Test inter-agent communication...
       bash tests/agent-operations.sh cleanup-all
    
    4. Template Validation
       bash tests/agent-operations.sh developer
       bash tests/agent-operations.sh reviewer
       bash tests/agent-operations.sh coordinator
       bash tests/agent-operations.sh cleanup-all

EOF
}

cmd_version() {
    echo "Test Agent Creator v1.0"
    echo ""
    echo "Requirements:"
    echo "  - Python 3.8+"
    echo "  - requests library (pip install requests)"
    echo "  - Mission Control running (pnpm dev)"
}

# Main dispatcher
main() {
    if [[ -z "$1" ]]; then
        cmd_help
        exit 0
    fi

    case "$1" in
        single)
            cmd_single "$2" "$3"
            ;;
        batch)
            cmd_batch "$2" "$3"
            ;;
        batch-quick)
            cmd_batch_no_souls "$2" "$3"
            ;;
        developer)
            cmd_developer "$2"
            ;;
        reviewer)
            cmd_reviewer "$2"
            ;;
        coordinator)
            cmd_coordinator "$2"
            ;;
        with-soul)
            cmd_with_soul "$2" "$3"
            ;;
        list)
            cmd_list
            ;;
        load-test)
            cmd_load_test "$2"
            ;;
        stress-test)
            cmd_stress_test "$2"
            ;;
        scenario)
            cmd_test_scenario
            ;;
        cleanup)
            cmd_cleanup "$2"
            ;;
        cleanup-all)
            cmd_cleanup_batch
            ;;
        help|-h|--help)
            cmd_help
            ;;
        version|--version)
            cmd_version
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Run
main "$@"
