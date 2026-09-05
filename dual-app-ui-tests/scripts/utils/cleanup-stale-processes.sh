#!/bin/bash

# CVS Maestro Stale Process Cleanup Script
# Identifies and cleans up stale processes from test runs

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Common stale processes in Maestro environment
STALE_PROCESSES=(
    "maestro"
    "simulator"
    "xcrun"
    "adb"
    "emulator"
    "qemu-system"
    "gradle"
    "node"
    "npm"
    "java"
    "python"
    "ruby"
    "cvs"
    "pharmacy"
    "health"
    "android"
    "ios"
)

# PIDs to track
PIDS_TO_CLEAN=()

echo -e "${BLUE}🔍 CVS Maestro Stale Process Cleanup${NC}"
echo "=================================="

# Function to check if process is stale
is_stale_process() {
    local pid=$1
    local process_name=$2
    local start_time
    
    # Get process start time
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        start_time=$(ps -p "$pid" -o lstart= | head -1 | xargs -I {} date -j -f "%a %b %d %H:%M:%S %Y" "{}" +%s 2>/dev/null || echo "")
    else
        # Linux
        start_time=$(ps -p "$pid" -o lstart= | head -1 | xargs -I {} date -d "{}" +%s 2>/dev/null || echo "")
    fi
    
    if [[ -z "$start_time" ]]; then
        return 1
    fi
    
    # Check if process is older than 1 hour
    local current_time=$(date +%s)
    local age=$((current_time - start_time))
    local max_age=3600  # 1 hour in seconds
    
    if [[ $age -gt $max_age ]]; then
        return 0  # Process is stale
    else
        return 1  # Process is fresh
    fi
}

# Function to get process details
get_process_details() {
    local pid=$1
    local process_name=$2
    
    echo "PID: $pid"
    echo "Name: $process_name"
    echo "Command: $(ps -p "$pid" -o command= | head -1)"
    echo "Start Time: $(ps -p "$pid" -o lstart= | head -1)"
    echo "CPU Time: $(ps -p "$pid" -o time= | head -1)"
    echo "Memory: $(ps -p "$pid" -o rss= | head -1 | awk '{print $1/1024 " MB"}')"
    echo "---"
}

# Function to kill process gracefully
kill_process_gracefully() {
    local pid=$1
    local process_name=$2
    
    echo -e "${YELLOW}🔄 Attempting graceful termination of $process_name (PID: $pid)${NC}"
    
    # Try SIGTERM first
    if kill -TERM "$pid" 2>/dev/null; then
        sleep 5
        
        # Check if still running
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Process still running, forcing termination...${NC}"
            kill -KILL "$pid" 2>/dev/null || true
        else
            echo -e "${GREEN}✅ Process terminated gracefully${NC}"
            return 0
        fi
    else
        echo -e "${RED}❌ Failed to send SIGTERM to process $pid${NC}"
        return 1
    fi
    
    # Final check
    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${RED}❌ Failed to kill process $pid${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Process force-killed${NC}"
        return 0
    fi
}

# Main cleanup function
cleanup_stale_processes() {
    local dry_run=${1:-false}
    
    echo -e "${BLUE}🔍 Scanning for stale processes...${NC}"
    echo ""
    
    # Find potential stale processes
    for process in "${STALE_PROCESSES[@]}"; do
        echo -e "${BLUE}Checking for stale $process processes...${NC}"
        
        # Get all PIDs for the process
        local pids=()
        while IFS= read -r line; do
            [[ -n "$line" ]] && pids+=("$line")
        done < <(pgrep -i "$process" 2>/dev/null || true)
        
        if [[ ${#pids[@]} -eq 0 ]]; then
            echo -e "${GREEN}✅ No $process processes found${NC}"
            echo ""
            continue
        fi
        
        echo -e "${YELLOW}Found ${#pids[@]} $process processes:${NC}"
        echo ""
        
        # Check each PID
        for pid in "${pids[@]}"; do
            if is_stale_process "$pid" "$process"; then
                echo -e "${RED}🚨 STALE PROCESS DETECTED:${NC}"
                get_process_details "$pid" "$process"
                PIDS_TO_CLEAN+=("$pid:$process")
            else
                echo -e "${GREEN}✅ Fresh process (PID: $pid) - keeping${NC}"
                echo ""
            fi
        done
    done
    
    # Summary
    if [[ ${#PIDS_TO_CLEAN[@]} -eq 0 ]]; then
        echo -e "${GREEN}🎉 No stale processes found!${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}📊 Summary: Found ${#PIDS_TO_CLEAN[@]} stale processes${NC}"
    echo ""
    
    if [[ "$dry_run" == "true" ]]; then
        echo -e "${BLUE}🔍 DRY RUN - No processes will be killed${NC}"
        for pid_info in "${PIDS_TO_CLEAN[@]}"; do
            IFS=':' read -r pid process_name <<< "$pid_info"
            echo "Would kill: $process_name (PID: $pid)"
        done
        return 0
    fi
    
    # Ask for confirmation
    echo -e "${YELLOW}⚠️  Do you want to kill these stale processes? (y/N)${NC}"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🧹 Cleaning up stale processes...${NC}"
        echo ""
        
        local killed_count=0
        local failed_count=0
        
        for pid_info in "${PIDS_TO_CLEAN[@]}"; do
            IFS=':' read -r pid process_name <<< "$pid_info"
            
            if kill_process_gracefully "$pid" "$process_name"; then
                ((killed_count++))
            else
                ((failed_count++))
            fi
            echo ""
        done
        
        echo -e "${GREEN}✅ Cleanup completed!${NC}"
        echo -e "${GREEN}   Killed: $killed_count processes${NC}"
        echo -e "${RED}   Failed: $failed_count processes${NC}"
    else
        echo -e "${BLUE}🚫 Cleanup cancelled${NC}"
    fi
}

# Function to show current process status
show_process_status() {
    echo -e "${BLUE}📊 Current Process Status${NC}"
    echo "=========================="
    echo ""
    
    for process in "${STALE_PROCESSES[@]}"; do
        local pids=()
        while IFS= read -r line; do
            [[ -n "$line" ]] && pids+=("$line")
        done < <(pgrep -i "$process" 2>/dev/null || true)
        
        if [[ ${#pids[@]} -gt 0 ]]; then
            echo -e "${YELLOW}$process: ${#pids[@]} processes${NC}"
            for pid in "${pids[@]}"; do
                echo "  PID: $pid - $(ps -p "$pid" -o command= | head -1 | cut -c1-60)"
            done
        else
            echo -e "${GREEN}$process: No processes${NC}"
        fi
        echo ""
    done
}

# Function to kill specific process by PID
kill_by_pid() {
    local pid=$1
    
    if ! kill -0 "$pid" 2>/dev/null; then
        echo -e "${RED}❌ Process $pid does not exist${NC}"
        return 1
    fi
    
    local process_name=$(ps -p "$pid" -o comm= | head -1)
    echo -e "${BLUE}🎯 Killing process: $process_name (PID: $pid)${NC}"
    
    kill_process_gracefully "$pid" "$process_name"
}

# Function to clean up Maestro-specific processes
cleanup_maestro_processes() {
    echo -e "${BLUE}🧹 Cleaning up Maestro-specific processes...${NC}"
    echo ""
    
    # Kill Maestro processes
    local maestro_pids=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && maestro_pids+=("$line")
    done < <(pgrep -f "maestro" 2>/dev/null || true)
    
    for pid in "${maestro_pids[@]}"; do
        echo -e "${YELLOW}Killing Maestro process (PID: $pid)${NC}"
        kill_process_gracefully "$pid" "maestro"
    done
    
    # Kill simulator processes
    local sim_pids=()
    if [[ "$OSTYPE" == "darwin"* ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && sim_pids+=("$line")
        done < <(pgrep -f "simulator" 2>/dev/null || true)
        while IFS= read -r line; do
            [[ -n "$line" ]] && sim_pids+=("$line")
        done < <(pgrep -f "xcrun simctl" 2>/dev/null || true)
    fi
    
    for pid in "${sim_pids[@]}"; do
        echo -e "${YELLOW}Killing simulator process (PID: $pid)${NC}"
        kill_process_gracefully "$pid" "simulator"
    done
    
    # Kill Android processes
    local android_pids=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && android_pids+=("$line")
    done < <(pgrep -f "emulator" 2>/dev/null || true)
    while IFS= read -r line; do
        [[ -n "$line" ]] && android_pids+=("$line")
    done < <(pgrep -f "adb" 2>/dev/null || true)
    
    for pid in "${android_pids[@]}"; do
        echo -e "${YELLOW}Killing Android process (PID: $pid)${NC}"
        kill_process_gracefully "$pid" "android"
    done
}

# Main script logic
case "${1:-help}" in
    "dry-run")
        cleanup_stale_processes true
        ;;
    "cleanup")
        cleanup_stale_processes false
        ;;
    "status")
        show_process_status
        ;;
    "kill")
        if [[ -z "${2:-}" ]]; then
            echo -e "${RED}❌ Please provide a PID to kill${NC}"
            echo "Usage: $0 kill <PID>"
            exit 1
        fi
        kill_by_pid "$2"
        ;;
    "maestro")
        cleanup_maestro_processes
        ;;
    "help"|*)
        echo "CVS Maestro Stale Process Cleanup Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  dry-run    - Show stale processes without killing them"
        echo "  cleanup    - Kill all stale processes"
        echo "  status     - Show current process status"
        echo "  kill <PID> - Kill specific process by PID"
        echo "  maestro    - Clean up Maestro-specific processes only"
        echo "  help       - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 dry-run     # Check for stale processes"
        echo "  $0 cleanup     # Clean up stale processes"
        echo "  $0 status      # Show current processes"
        echo "  $0 kill 12345  # Kill specific process"
        echo "  $0 maestro     # Clean up Maestro processes"
        ;;
esac
