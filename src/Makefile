LDFLAGSPRD := $(shell cat ldflags_prod.txt)
LDFLAGSDEV := $(shell cat ldflags_dev.txt)
LDFLAGSLOCAL := $(shell cat ldflags_local.txt)

CONTAINER_IMAGE_NAME := "us-central1-docker.pkg.dev/yamasaki-dev/cloud-run-source-deploy/dokushokanjobun"


run-local:
	go run -ldflags="$(LDFLAGSLOCAL)" main.go

run-dev:
	go run -ldflags="$(LDFLAGSDEV)" main.go

build-dev:
	go build -ldflags="$(LDFLAGSDEV)" -o dist/dev/dokushokanjobun main.go && rsync -a --exclude-from=ignore_static_files.txt static dist/dev

build-test:
	env GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGSPRD)" -o dist/test/dokushokanjobun main.go && rsync -a --exclude-from=ignore_static_files.txt static dist/test

build-prod:
	env GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGSPRD)" -o dist/prod/dokushokanjobun main.go && rsync -a --exclude-from=ignore_static_files.txt static dist/prod

deploy-prod:
	docker build --platform linux/amd64 -t $(CONTAINER_IMAGE_NAME) . && gcloud auth configure-docker us-central1-docker.pkg.dev && docker push $(CONTAINER_IMAGE_NAME) && gcloud run deploy dokushokanjobun --image=$(CONTAINER_IMAGE_NAME):latest --port='8080' --region=us-central1 --allow-unauthenticated

run-container-prod:
	docker run -it -p 8080:8080 $(CONTAINER_IMAGE_NAME)
