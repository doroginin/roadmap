# Makefile for roadmap-planner

# Объявляем phony цели
.PHONY: install start build clean

# Установка зависимостей проекта
install:
	npm install

# Запуск сервера разработки (блокирующая команда)
start:
	npm run dev

# Сборка production-версии приложения
build:
	npm run build

# Удаление node_modules и package-lock.json
clean:
	rm -rf node_modules
	rm -f package-lock.json