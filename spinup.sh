#!/bin/bash
set -e

# --- Step 1: Start Docker container if not running ---
CONTAINER_NAME="oc-agent"
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "Starting Docker container $CONTAINER_NAME..."
    docker start "$CONTAINER_NAME"
else
    echo "Docker container $CONTAINER_NAME already running."
fi

# --- Step 2: Start server.py in background ---
echo "Starting web server for dog-web-app..."
cd ./dog-web-app
gnome-terminal -- bash -c "python3 server.py; exec bash"

# --- Step 3: Launch OpenCode inside Docker ---
echo "Launching OpenCode inside Docker..."
docker exec -it "$CONTAINER_NAME" opencode
