package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kintone-labs/go-kintone"
	"google.golang.org/api/iterator"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"

	openai "github.com/sashabaranov/go-openai"

	firestore "cloud.google.com/go/firestore"
)

type ItemV2 struct {
	Timestamp time.Time `json:"timestamp" firestore:"timestamp,omitempty"`
	Field     string    `json:"field" firestore:"field,omitempty"`
	Value     float64   `json:"value" firestore:"value,omitempty"`
}

type Item struct {
	Timestamp string  `json:"timestamp"`
	Field     string  `json:"field"`
	Value     float64 `json:"value"`
}

type EmotionData struct {
	Title                    string    `json:"title"`
	Body                     string    `json:"body"`
	ReadingStartTime         string    `json:"readingStartTime"`
	ReadingEndTime           string    `json:"readingEndTime"`
	ReadingDuration          int       `json:"readingDuration"`
	ExpressionCountSad       float64   `json:"expressionCountSad"`
	ExpressionCountHappy     float64   `json:"expressionCountHappy"`
	ExpressionCountAngry     float64   `json:"expressionCountAngry"`
	ExpressionCountFearful   float64   `json:"expressionCountFearful"`
	ExpressionCountDisgusted float64   `json:"expressionCountDisgusted"`
	ExpressionCountSurprised float64   `json:"expressionCountSurprised"`
	SensorHeartRates         []float64 `json:"sensorHeartRates"`
}

type GeneratedText struct {
	Text string `json:"text"`
	Id   string `json:"id"`
}

type UserFeeling struct {
	FeelingText string `json:"feelingText"`
	FeelingId   string `json:"feelingId"`
	BookTitle   string `json:"bookTitle"`
	UserId      string `json:"userId"`
}

var InfluxURL string
var InfluxToken string
var InfluxOrg string
var InfluxBucket string

var FirestoreProjectID string
var FirestoreDatabaseID string
var FirestoreCollectionName string

var OpenAIApiKey string

var KintoneDomain string // example.kintone.com
var KintoneApiToken string
var KintoneAppId string
var KintoneUserAppApiToken string
var KintoneUserAppId string

func main() {
	r := gin.Default()

	r.Static("/app", "./static")
	// r.Static("/assets", "./static/assets")

	// CORSミドルウェアの設定
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"}, // 必要に応じて適切なオリジンを指定してください
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.POST("/api/capture/:captureId/items/:measurement", postItemsV2)
	r.GET("/api/capture/:captureId/items/:measurement", getItemsV2)

	r.POST("/api/generate", generateText)
	r.GET("/api/feeling/:feelingId", getFeelingText)

	r.POST("/api/user/:userId/feeling/:feelingId", postUserFeeling)
	r.GET("/api/user/:userId/feeling", getUserFeelingList)
	r.GET("/api/user/:userId/feeling/:feelingId", getUserFeeling)

	r.Run(":8080")
}

func postItemsV2(c *gin.Context) {
	var items []ItemV2
	if err := c.ShouldBindJSON(&items); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if FirestoreProjectID == "" || FirestoreDatabaseID == "" || FirestoreCollectionName == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Firestore environment variables not set"})
		return
	}

	captureId := c.Param("captureId")
	measurement := c.Param("measurement")

	ctx := context.Background()
	client, err := firestore.NewClientWithDatabase(ctx, FirestoreProjectID, FirestoreDatabaseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	coll := client.Collection(FirestoreCollectionName)
	capt := coll.Doc(captureId)
	meas := capt.Collection(measurement)

	for _, item := range items {
		ref := meas.NewDoc()
		_, err := ref.Set(ctx, item)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	c.Status(http.StatusNoContent)
}

func getItemsV2(c *gin.Context) {
	if FirestoreProjectID == "" || FirestoreDatabaseID == "" || FirestoreCollectionName == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Firestore environment variables not set"})
		return
	}

	start := c.Query("start")
	end := c.Query("end")
	field := c.Query("field")

	if start == "" || end == "" || field == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required query parameters"})
		return
	}

	upper := c.Query("upper")
	lower := c.Query("lower")

	measurement := c.Param("measurement")
	captureId := c.Param("captureId")

	ctx := context.Background()
	client, err := firestore.NewClientWithDatabase(ctx, FirestoreProjectID, FirestoreDatabaseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	coll := client.Collection(FirestoreCollectionName)
	capt := coll.Doc(captureId)
	meas := capt.Collection(measurement)

	startTime, err := time.Parse(time.RFC3339Nano, start)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid timestamp format"})
		return
	}
	endTime, err := time.Parse(time.RFC3339Nano, end)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid timestamp format"})
		return
	}

	ref := meas.Where("timestamp", ">=", startTime).Where("timestamp", "<=", endTime).Where("field", "==", field)
	if lower != "" {
		lowerF, err := strconv.ParseFloat(lower, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		ref = ref.Where("value", ">=", lowerF)
	}

	if upper != "" {
		upperF, err := strconv.ParseFloat(upper, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		ref = ref.Where("value", "<=", upperF)
	}

	iter := ref.Documents(ctx)

	var items []ItemV2
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		}

		if doc == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No document found"})
			return
		}

		var item ItemV2
		doc.DataTo(&item)
		items = append(items, item)
	}
	c.JSON(http.StatusOK, items)
}

func postItems(c *gin.Context) {
	var items []Item
	if err := c.ShouldBindJSON(&items); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if InfluxURL == "" || InfluxToken == "" || InfluxOrg == "" || InfluxBucket == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "InfluxDB environment variables not set"})
		return
	}

	client := influxdb2.NewClient(InfluxURL, InfluxToken)
	defer client.Close()

	writeAPI := client.WriteAPIBlocking(InfluxOrg, InfluxBucket)

	measurement := c.Param("measurement")
	captureId := c.Param("captureId")

	for _, item := range items {
		t, err := time.Parse(time.RFC3339Nano, item.Timestamp)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid timestamp format"})
			return
		}

		p := influxdb2.NewPoint(measurement,
			map[string]string{"captureId": captureId, "unit": "default"},
			map[string]interface{}{item.Field: item.Value},
			t)

		if err := writeAPI.WritePoint(context.Background(), p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write to InfluxDB"})
			return
		}
	}

	c.Status(http.StatusNoContent)
}

func getItems(c *gin.Context) {
	if InfluxURL == "" || InfluxToken == "" || InfluxOrg == "" || InfluxBucket == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "InfluxDB environment variables not set"})
		return
	}

	start := c.Query("start")
	end := c.Query("end")
	field := c.Query("field")

	if start == "" || end == "" || field == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required query parameters"})
		return
	}

	upper := c.Query("upper")
	lower := c.Query("lower")

	client := influxdb2.NewClient(InfluxURL, InfluxToken)
	defer client.Close()

	queryAPI := client.QueryAPI(InfluxOrg)

	measurement := c.Param("measurement")
	captureId := c.Param("captureId")

	query := fmt.Sprintf(`from(bucket: "%s")
	|> range(start: %s, stop: %s)
    |> filter(fn: (r) => r._measurement == "%s" and r.captureId == "%s" and r._field == "%s")`, InfluxBucket, start, end, measurement, captureId, field)

	if lower != "" {
		query += fmt.Sprintf(`|> filter(fn: (r) => r._value >= %s)`, lower)
	}

	if upper != "" {
		query += fmt.Sprintf(`|> filter(fn: (r) => r._value <= %s)`, upper)
	}

	result, err := queryAPI.Query(context.Background(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query InfluxDB"})
		return
	}

	var items []Item
	for result.Next() {
		record := result.Record()
		timestamp := record.Time().Format(time.RFC3339Nano)
		value := record.Value().(float64)
		items = append(items, Item{
			Timestamp: timestamp,
			Field:     field,
			Value:     value,
		})
	}

	if result.Err() != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Err().Error()})
		return
	}

	c.JSON(http.StatusOK, items)
}

func generateText(c *gin.Context) {
	var emotionData EmotionData
	if err := c.ShouldBindJSON(&emotionData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if OpenAIApiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OpenAI API key not set"})
		return
	}

	systemPrompt, err := ioutil.ReadFile("system_prompt.txt")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read system prompt file"})
		return
	}

	id, err := uuid.NewRandom()
	if err != nil {
		panic(err)
	}

	client := openai.NewClient(OpenAIApiKey)

	// EmotionDataをJSON形式に変換
	emotionDataJSON, err := json.Marshal(emotionData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal emotion data"})
		return
	}

	messages := []openai.ChatCompletionMessage{
		{
			Role:    "system",
			Content: string(systemPrompt),
		},
		{
			Role:    "user",
			Content: string(emotionDataJSON),
		},
	}

	req := openai.ChatCompletionRequest{
		Model:    "gpt-4o",
		Messages: messages,
	}

	resp, err := client.CreateChatCompletion(context.Background(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate text"})
		return
	}

	feelingText := resp.Choices[0].Message.Content

	var strHeatRates []string
	for _, number := range emotionData.SensorHeartRates {
		strHeatRates = append(strHeatRates, fmt.Sprintf("%.1f", number))
	}
	strHeatRatesValue := strings.Join(strHeatRates, ", ")

	appIdNum, _ := strconv.ParseUint(KintoneAppId, 10, 64)

	// kintone
	app := &kintone.App{
		Domain:   KintoneDomain,
		ApiToken: KintoneApiToken,
		AppId:    appIdNum,
	}

	records := make([]*kintone.Record, 0)

	record := make(map[string]interface{})
	record["id"] = kintone.SingleLineTextField(id.String())
	record["feeling_text"] = kintone.MultiLineTextField(feelingText)
	record["book_title"] = kintone.SingleLineTextField(emotionData.Title)
	record["book_body"] = kintone.MultiLineTextField(emotionData.Body)
	record["start_time"] = kintone.SingleLineTextField(emotionData.ReadingStartTime)
	record["end_time"] = kintone.SingleLineTextField(emotionData.ReadingEndTime)
	record["duration"] = kintone.RecordNumberField(strconv.Itoa(emotionData.ReadingDuration))
	record["expression_count_sad"] = kintone.RecordNumberField(strconv.FormatFloat(emotionData.ExpressionCountSad, 'f', -1, 64))
	record["expression_count_happy"] = kintone.RecordNumberField(strconv.FormatFloat(emotionData.ExpressionCountHappy, 'f', -1, 64))
	record["expression_count_angry"] = kintone.RecordNumberField(strconv.FormatFloat(emotionData.ExpressionCountAngry, 'f', -1, 64))
	record["expression_count_fearful"] = kintone.RecordNumberField(strconv.FormatFloat(emotionData.ExpressionCountFearful, 'f', -1, 64))
	record["expression_count_disgusted"] = kintone.RecordNumberField(strconv.FormatFloat(emotionData.ExpressionCountDisgusted, 'f', -1, 64))
	record["expression_count_surprised"] = kintone.RecordNumberField(strconv.FormatFloat(emotionData.ExpressionCountSurprised, 'f', -1, 64))
	record["sensor_heartrates"] = kintone.SingleLineTextField(strHeatRatesValue)
	records = append(records, kintone.NewRecord(record))

	// レコードをkintoneに追加。
	ids, err := app.AddRecords(records)
	if err != nil {
		fmt.Println("Error adding record:", err)
		panic(err)
	}

	fmt.Println("Record added successfully with ID:", ids)

	c.JSON(http.StatusOK, GeneratedText{Text: feelingText, Id: id.String()})
}

func getFeelingText(c *gin.Context) {
	feelingId := c.Param("feelingId")

	// kintone
	appIdNum, _ := strconv.ParseUint(KintoneAppId, 10, 64)

	app := &kintone.App{
		Domain:   KintoneDomain,
		ApiToken: KintoneApiToken,
		AppId:    appIdNum,
	}

	records, err := app.GetRecords(nil, fmt.Sprintf(`id = "%s"`, feelingId))
	if err != nil {
		panic(err)
	}

	record := records[0]
	feeling_text := fmt.Sprintf(`%s`, record.Fields["feeling_text"])
	feeling_id := fmt.Sprintf(`%s`, record.Fields["id"])

	c.JSON(http.StatusOK, GeneratedText{Text: feeling_text, Id: feeling_id})
}

func postUserFeeling(c *gin.Context) {
	userId := c.Param("userId")
	feelingId := c.Param("feelingId")

	// kintone
	appIdNum, _ := strconv.ParseUint(KintoneAppId, 10, 64)

	app := &kintone.App{
		Domain:   KintoneDomain,
		ApiToken: KintoneApiToken,
		AppId:    appIdNum,
	}

	records, err := app.GetRecords(nil, fmt.Sprintf(`id = "%s"`, feelingId))
	if err != nil {
		log.Fatal(err)
		panic(err)
	}

	record := records[0]

	feeling_id := fmt.Sprintf(`%s`, record.Fields["id"])
	feeling_text := fmt.Sprintf(`%s`, record.Fields["feeling_text"])
	book_title := fmt.Sprintf(`%s`, record.Fields["book_title"])

	// add to kintone user table
	userAppIdNum, _ := strconv.ParseUint(KintoneUserAppId, 10, 64)

	userApp := &kintone.App{
		Domain:   KintoneDomain,
		ApiToken: KintoneUserAppApiToken,
		AppId:    userAppIdNum,
	}

	userrecords := make([]*kintone.Record, 0)

	userrecord := make(map[string]interface{})
	userrecord["feeling_id"] = kintone.SingleLineTextField(feeling_id)
	userrecord["line_user_id"] = kintone.SingleLineTextField(userId)
	userrecord["feeling_text"] = kintone.MultiLineTextField(feeling_text)
	userrecord["book_title"] = kintone.SingleLineTextField(book_title)

	userrecords = append(userrecords, kintone.NewRecord(userrecord))

	// レコードをkintoneに追加。
	ids, err := userApp.AddRecords(userrecords)
	if err != nil {
		fmt.Println("Error adding record:", err)
		panic(err)
	}

	fmt.Println("Record added successfully with ID:", ids)

	c.Status(http.StatusNoContent)
}

func getUserFeelingList(c *gin.Context) {
	userId := c.Param("userId")

	// add to kintone user table
	userAppIdNum, _ := strconv.ParseUint(KintoneUserAppId, 10, 64)

	userApp := &kintone.App{
		Domain:   KintoneDomain,
		ApiToken: KintoneUserAppApiToken,
		AppId:    userAppIdNum,
	}

	userrecords, err := userApp.GetRecords(nil, fmt.Sprintf(`line_user_id = "%s"`, userId))
	if err != nil {
		panic(err)
	}

	var userFeelingList []UserFeeling
	for _, userrecord := range userrecords {
		userFeelingList = append(userFeelingList,
			UserFeeling{
				FeelingText: fmt.Sprintf(`%s`, userrecord.Fields["feeling_text"]),
				FeelingId:   fmt.Sprintf(`%s`, userrecord.Fields["feeling_id"]),
				BookTitle:   fmt.Sprintf(`%s`, userrecord.Fields["book_title"]),
				UserId:      fmt.Sprintf(`%s`, userrecord.Fields["line_user_id"]),
			},
		)
	}

	c.JSON(http.StatusOK, userFeelingList)
}

func getUserFeeling(c *gin.Context) {
	userId := c.Param("userId")
	feelingId := c.Param("feelingId")

	// add to kintone user table
	userAppIdNum, _ := strconv.ParseUint(KintoneUserAppId, 10, 64)

	userApp := &kintone.App{
		Domain:   KintoneDomain,
		ApiToken: KintoneUserAppApiToken,
		AppId:    userAppIdNum,
	}

	userrecords, err := userApp.GetRecords(nil, fmt.Sprintf(`line_user_id = "%s" and feeling_id = "%s"`, userId, feelingId))
	if err != nil {
		panic(err)
	}
	userrecord := userrecords[0]

	userFeeling := UserFeeling{
		FeelingText: fmt.Sprintf(`%s`, userrecord.Fields["feeling_text"]),
		FeelingId:   fmt.Sprintf(`%s`, userrecord.Fields["feeling_id"]),
		BookTitle:   fmt.Sprintf(`%s`, userrecord.Fields["book_title"]),
		UserId:      fmt.Sprintf(`%s`, userrecord.Fields["line_user_id"]),
	}

	c.JSON(http.StatusOK, userFeeling)
}
