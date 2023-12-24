.PHONY: clear-cache

clear-cache:
	@echo "Clearing Laravel cache..."
	php artisan cache:clear
	php artisan config:clear
	php artisan route:clear
	php artisan view:clear
	php artisan event:clear

	@echo "Clearing Vite cache..."
	rm -rf node_modules
	rm -rf public/build
	npm install

