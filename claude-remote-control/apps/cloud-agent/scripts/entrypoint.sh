#!/bin/bash
set -e

# =============================================================================
# Initialize persistent volume structure
# Volume is mounted at /home/quivr/persistent - use symlinks for persistence
# while keeping Docker-installed tools (.cargo, .bun, .deno) intact
# =============================================================================
echo "Initializing persistent storage..."

# Create directories on the persistent volume
mkdir -p /home/quivr/persistent/.247/data
mkdir -p /home/quivr/persistent/workspace

# Symlink .247 from home to persistent volume
if [ -d /home/quivr/.247 ] && [ ! -L /home/quivr/.247 ]; then
  # .247 exists as directory from Dockerfile, migrate contents and replace with symlink
  cp -a /home/quivr/.247/* /home/quivr/persistent/.247/ 2>/dev/null || true
  rm -rf /home/quivr/.247
fi
if [ ! -e /home/quivr/.247 ]; then
  ln -sf /home/quivr/persistent/.247 /home/quivr/.247
fi

# Copy default config if not exists on volume
if [ ! -f /home/quivr/persistent/.247/config.json ]; then
  cp /opt/247-agent/config.json /home/quivr/persistent/.247/config.json 2>/dev/null || true
fi

# Symlink /workspace to persistent volume
if [ -d /workspace ] && [ ! -L /workspace ]; then
  # /workspace is a directory from Dockerfile, replace with symlink
  if [ "$(ls -A /workspace 2>/dev/null)" ]; then
    cp -a /workspace/* /home/quivr/persistent/workspace/ 2>/dev/null || true
  fi
  sudo rm -rf /workspace
fi
if [ ! -e /workspace ]; then
  sudo ln -sf /home/quivr/persistent/workspace /workspace
fi

# Ensure proper ownership on persistent volume
sudo chown -R quivr:quivr /home/quivr/persistent

# Change to valid directory (cwd may be invalid after symlink replacement)
cd /home/quivr/persistent/workspace

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
