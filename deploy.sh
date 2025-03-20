#!/bin/zsh

#chmod +x deploy.sh 

# Exit script if any command fails
set -e

# Store the current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"

# Check if there are uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Error: You have uncommitted changes. Please commit or stash them before deploying."
  exit 1
fi

# Function to return to the original branch in case of errors
cleanup() {
  echo "Returning to branch: $CURRENT_BRANCH"
  git checkout "$CURRENT_BRANCH"
}

# Set the cleanup function to run on script exit
trap cleanup EXIT

echo "Checking if gh-pages branch exists..."
if git show-ref --verify --quiet refs/heads/gh-pages; then
  echo "Switching to gh-pages branch..."
  git checkout gh-pages
else
  echo "Creating gh-pages branch..."
  git checkout -b gh-pages
fi

echo "Merging latest changes from main branch..."
git merge "$CURRENT_BRANCH" --no-commit --no-ff

echo "Building the project..."
npm run build

echo "Adding built files from docs directory..."
git add -f docs/

# Create a commit with the current date and time
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo "Creating deployment commit..."
git commit -m "Deployment: $TIMESTAMP"

echo "Force pushing to gh-pages branch on origin..."
git push origin gh-pages --force

echo "Deployment completed successfully!"