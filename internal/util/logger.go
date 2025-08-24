package util

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type LogLevel string

const (
	LevelInfo  LogLevel = "INFO"
	LevelDebug LogLevel = "DEBUG"
	LevelError LogLevel = "ERROR"
	LevelFatal LogLevel = "FATAL"
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

	fmt.Printf("LOG %s %s\n", level, msg)
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
