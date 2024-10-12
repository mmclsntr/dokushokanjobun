LDFLAGSPRD := $(shell cat ldflags_prod.txt)
LDFLAGSDEV := $(shell cat ldflags_dev.txt)
LDFLAGSLOCAL := $(shell cat ldflags_local.txt)

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
