#!/bin/bash
set -e

# =============================================================================
# Initialize persistent volume structure
# Volume is mounted at /home/quivr - ensure proper structure for persistence
# =============================================================================
echo "Initializing persistent storage..."

# Create workspace directory inside home (on volume)
mkdir -p /home/quivr/workspace

# Create symlink from /workspace to /home/quivr/workspace
if [ -d /workspace ] && [ ! -L /workspace ]; then
  # /workspace is a directory from Dockerfile, replace with symlink
  if [ "$(ls -A /workspace 2>/dev/null)" ]; then
    cp -a /workspace/* /home/quivr/workspace/ 2>/dev/null || true
  fi
  sudo rm -rf /workspace
  sudo ln -sf /home/quivr/workspace /workspace
elif [ ! -e /workspace ]; then
  sudo ln -sf /home/quivr/workspace /workspace
fi

# Ensure .247 config directory exists on volume
mkdir -p /home/quivr/.247/data

# Copy default config if not exists on volume
if [ ! -f /home/quivr/.247/config.json ]; then
  cp /opt/247-agent/config.json /home/quivr/.247/config.json 2>/dev/null || true
fi

# Ensure proper ownership
sudo chown -R quivr:quivr /home/quivr

# Change to valid directory (cwd may be invalid after symlink replacement)
cd /home/quivr/workspace

echo "Persistent storage initialized"

# =============================================================================
# Configure GitHub authentication if token is available
# This enables Git operations (clone, push, commit) in the cloud agent
if [ -n "$GITHUB_TOKEN" ]; then
  echo "Configuring GitHub authentication..."

  # Login to GitHub CLI with the token
  echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true

  # Configure Git to use GitHub CLI for authentication
  gh auth setup-git 2>/dev/null || true

  # Set Git identity from environment variables
  git config --global user.name "${GIT_USER_NAME:-Quivr User}"
  git config --global user.email "${GIT_USER_EMAIL:-noreply@quivr.com}"

  echo "GitHub authentication configured successfully"
fi

# Start the agent
exec node /opt/247-agent/dist/index.js
