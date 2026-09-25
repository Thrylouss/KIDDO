.PHONY: help setup up down restart logs shell-php shell-node migrate seed test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## First-time project setup
	@echo "Setting up KIDDO..."
	cp -n .env.example .env || true
	cp -n backend/.env.example backend/.env || true
	docker compose up -d postgres
	@echo "Waiting for PostgreSQL..."
	sleep 5
	docker compose run --rm php composer install --no-interaction
	docker compose run --rm php php artisan key:generate
	docker compose run --rm php php artisan migrate --seed
	docker compose up -d
	@echo "✓ KIDDO is ready at http://localhost:3000 (frontend) and http://localhost:8000 (API)"

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Tail logs (all services)
	docker compose logs -f

logs-php: ## Tail PHP logs
	docker compose logs -f php

shell-php: ## Open shell in PHP container
	docker compose exec php sh

shell-node: ## Open shell in frontend container
	docker compose exec frontend sh

migrate: ## Run database migrations
	docker compose exec php php artisan migrate

migrate-fresh: ## Fresh migration with seed (DESTROYS DATA)
	docker compose exec php php artisan migrate:fresh --seed

seed: ## Run database seeders
	docker compose exec php php artisan db:seed

test: ## Run backend tests
	docker compose exec php php artisan test

test-filter: ## Run specific test: make test-filter F=HealthCheck
	docker compose exec php php artisan test --filter=$(F)

cache-clear: ## Clear all caches
	docker compose exec php php artisan optimize:clear

tools: ## Start with pgAdmin
	docker compose --profile tools up -d
