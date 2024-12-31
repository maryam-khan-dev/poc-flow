DEFAULT_TARGET=app
DEFAULT_ENV=dev
override TARGET ?= $(DEFAULT_TARGET)
override ENV ?= $(DEFAULT_ENV)
down:
	docker compose -f docker-compose.$(ENV).yaml down  
refresh:
	docker compose -f docker-compose.$(ENV).yaml build $(TARGET) \
	&& docker compose -f docker-compose.$(ENV).yaml up --no-deps -d $(TARGET)
rebuild:
	docker compose -f docker-compose.$(ENV).yaml build  \
	&& docker compose -f docker-compose.$(ENV).yaml up -d 

	
