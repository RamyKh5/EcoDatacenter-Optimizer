# Team Workflow

## Rules
1. Never push directly to `main`. Always use a branch + Pull Request.
2. One branch per task. Delete after merge.
3. Pull `main` every morning before starting work.
4. Commit messages in English, present tense, imperative.
   Example: "Add data cleaning function" (not "added" or "adding").
5. One PR requires the other teammate's approval before merge.
6. No data, models, venv, or secrets in Git. See `.gitignore`.
7. If stuck on a merge conflict for more than 30 minutes, ask for help.

## Branch naming
- `feature/...` for new functionality
- `bugfix/...` for bug fixes
- `docs/...` for documentation
- `experiment/...` for throwaway experiments

## Commit message style
- Present tense, imperative
- Under 72 characters for the first line
- If needed, add a blank line and a longer description below

## Daily workflow
```bash
git checkout main
git pull origin main
git checkout -b feature/your-task
# ... work ...
git add <files>
git commit -m "Your message"
git push -u origin feature/your-task
# open PR on GitHub