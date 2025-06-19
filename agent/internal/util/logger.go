package util

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

type LogLevel string

const (
	LevelInfo  LogLevel = "info"
	LevelDebug LogLevel = "debug"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
	LevelMsg   LogLevel = "msg"
)

type LogMessage struct {
	Level   LogLevel
	Time    string
	Message any
}

type Logger struct {
	debugEnabled bool
	encoder      *json.Encoder
	pool         *sync.Pool
}

var logger = NewLogger()

func GetLogger() *Logger {
	return logger
}

func NewLogger() *Logger {
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)

	return &Logger{
		encoder: enc,
		pool: &sync.Pool{
			New: func() any {
				return &LogMessage{}
			},
		},
	}
}

func (l *Logger) SetDebug(enabled bool) {
	if enabled {
		l.debugEnabled = true
		l.Info("Enabling Debug logging for headplane-agent")
		l.Info("Be careful, this will spam a lot of information")
	}
}

func (l *Logger) log(level LogLevel, format string, v ...any) {
	msg := fmt.Sprintf(format, v...)
	timestamp := time.Now().Format(time.RFC3339)

	// Manually construct compact JSON line for performance
	line := `{"Level":"` + string(level) +
		`","Time":"` + timestamp +
		`","Message":"` + escapeString(msg) + `"}` + "\n"

	if level == LevelError || level == LevelFatal {
		os.Stderr.WriteString(line)
	}

	// Always write to stdout but also write to stderr for errors
	os.Stdout.WriteString(line)
	if level == LevelFatal {
		os.Exit(1)
	}
}

func (l *Logger) Debug(format string, v ...any) {
	if l.debugEnabled {
		l.log(LevelDebug, format, v...)
	}
}

func (l *Logger) Info(format string, v ...any)  { l.log(LevelInfo, format, v...) }
func (l *Logger) Error(format string, v ...any) { l.log(LevelError, format, v...) }
func (l *Logger) Fatal(format string, v ...any) { l.log(LevelFatal, format, v...) }

func (l *Logger) Msg(obj any) {
	entry := l.pool.Get().(*LogMessage)
	defer l.pool.Put(entry)

	entry.Level = LevelMsg
	entry.Time = time.Now().Format(time.RFC3339)
	entry.Message = obj

	// Because the encoder is tied to STDOUT we get a message
	_ = l.encoder.Encode(entry)

	// Reset the entry for reuse
	entry.Level = ""
	entry.Time = ""
	entry.Message = nil
}

func escapeString(s string) string {
	replacer := strings.NewReplacer(
		`"`, `\"`,
		`\`, `\\`,
		"\n", `\n`,
		"\t", `\t`,
	)
	return replacer.Replace(s)
}
