BASE_BRANCH ?= develop

review:
	@echo "=== Claude Code Review: $(BASE_BRANCH)...HEAD ==="
	@claude -p "以下のgit diffに対してコードレビューを日本語で実施してください。\n\
観点:\n\
- コードの品質・可読性\n\
- バグや潜在的な問題\n\
- セキュリティ上の懸念点（SQLインジェクション、XSS、認証・認可の不備など）\n\
- Laravelのベストプラクティスへの準拠\n\
- パフォーマンス上の問題\n\
\n\
重要な指摘を3つまでに絞ってください。問題がなければその旨も伝えてください。\n\
\n\
\`\`\`diff\n$$(git diff $(BASE_BRANCH)...HEAD)\n\`\`\`"

.PHONY: review
