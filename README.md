# Dokushokanjobun

## Introduction
https://protopedia.net/prototype/5393


## Setup

### Run InfluxDB

`datastore/` dir

```sh
docker compose up -d
```

### Create build flags

`src/` dir

Copy `ldflags_template.txt`

Create `ldflags_dev.txt` for development.

Create `ldflags_prod.txt` for production.


## Run for develop

`src/` dir

```sh
make run-dev
```


## Build for production
`src/` dir

```sh
make build-prod
```
