FROM golang:1.21-alpine

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
COPY ldflags_prod.txt ./

RUN go mod download

COPY ./ ./

RUN go build -ldflags="$(cat ldflags_prod.txt)" -o main main.go

EXPOSE 8080

CMD ["./main"]
