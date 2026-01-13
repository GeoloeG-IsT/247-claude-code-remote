#!/bin/bash
set -e

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
