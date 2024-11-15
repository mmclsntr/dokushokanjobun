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

Create `ldflags_local.txt` for local test.

Create `ldflags_dev.txt` for development.

Create `ldflags_prod.txt` for production.


## Run for local test

Run Firestore Emurator

```sh
gcloud emulators firestore start
```

`src/` dir

```sh
FIRESTORE_EMULATOR_HOST="[::1]:8913" make run-local
```


## Build for production
`src/` dir

```sh
make build-prod
```

## Deploy to CloudRun

`src/` dir

```sh
make deploy-prod
```

Set indexes of Firestore if needed.

## Open app

app page

```
https://{cloudrun endpoint}/app?captureId=test
```

camera page

```
https://{cloudrun endpoint}/app/camera.html
```
