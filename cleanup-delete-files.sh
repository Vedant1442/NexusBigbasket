#!/usr/bin/env bash
set -euo pipefail

# Adjust this if your default branch is not 'main' (e.g. 'master' or 'develop').
BASE_BRANCH="main"
BRANCH_NAME="cleanup/remove-redundant-files-$(date +%Y%m%d%H%M%S)"
COMMIT_MSG="chore: remove redundant legacy files"

# Files/paths to remove (will be skipped if not present)
files=(
  "backend/extractors/blinkit.js"
  "backend/extractors/zepto.js"
  "backend/extractors/instamart.js"
  "backend/extractors/bigbasket.js"
  "backend/lib/launchBrowser.js"
  "backend/lib/quickCommerce.js"
  "backend/lib/searchCache.js"
  "backend/config/db.js"
  "backend/models/Product.js"
  "backend/debug_blinkit.js"
  "backend/debug_stealth_api.js"
  "backend/discover_api.js"
  "backend/scripts/seedProducts.js"
  "versel.json"
  "frontend/src/App.css"
  "backend/proxies.txt"
  "Server.postman_collection.json"
)

# Directories to remove (if present)
dirs=(
  "scratch"
)

# Ensure working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Your working tree has changes. Please stash/commit them before running this script."
  exit 1
fi

# Fetch and checkout base branch
git fetch origin
git checkout "$BASE_BRANCH"
git pull --ff-only origin "$BASE_BRANCH"

# Create branch
git checkout -b "$BRANCH_NAME"

# Remove listed files (ignore missing)
for f in "${files[@]}"; do
  if [ -e "$f" ] || [ -L "$f" ]; then
    git rm -f "$f"
    echo "Removed: $f"
  else
    echo "Skipping (not found): $f"
  fi
done

# Remove listed directories (ignore missing)
for d in "${dirs[@]}"; do
  if [ -d "$d" ]; then
    git rm -r --ignore-unmatch "$d"
    echo "Removed directory: $d"
  else
    echo "Skipping directory (not found): $d"
  fi
done

# If nothing was removed, abort
if git status --porcelain | wc -l | tr -d ' ' | grep -q "^0$"; then
  echo "No files were removed. Aborting commit."
  git checkout "$BASE_BRANCH"
  git branch -D "$BRANCH_NAME"
  exit 0
fi

# Commit and push
git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH_NAME"

echo "Branch pushed: $BRANCH_NAME"
echo
echo "To open a PR using GitHub CLI (if installed), run:"
echo "  gh pr create --base $BASE_BRANCH --head $BRANCH_NAME --title \"$COMMIT_MSG\" --body \"Remove redundant legacy files and scripts.\""
echo
echo "If you want to apply the changes directly to $BASE_BRANCH instead of via a PR, replace the branch/commit steps with:"
echo "  git checkout $BASE_BRANCH"
echo "  (repeat the git rm steps if needed)"
echo "  git commit -m \"$COMMIT_MSG\""
echo "  git push origin $BASE_BRANCH"