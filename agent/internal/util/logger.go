package util

import (
	"log"
	"os"
	"sync"
)

type Logger struct {
	debug *log.Logger
	info  *log.Logger
	error *log.Logger
}

var lock = &sync.Mutex{}
var logger *Logger

func GetLogger() *Logger {
	if logger == nil {
		lock.Lock()
		defer lock.Unlock()
		if logger == nil {
			logger = NewLogger()
		}
	}

	return logger
}

func NewLogger() *Logger {
	// Create a new Logger for stdout and stderr
	// Errors still go to both stdout and stderr
	return &Logger{
		debug: nil,
		info:  log.New(os.Stdout, "[INFO] ", log.LstdFlags),
		error: log.New(os.Stderr, "[ERROR] ", log.LstdFlags),
	}
}

func (logger *Logger) SetDebug(debug bool) {
	if debug {
		logger.Info("Enabling Debug logging for headplane-agent")
		logger.Info("Be careful, this will spam a lot of information")
		logger.debug = log.New(os.Stdout, "[DEBUG] ", log.LstdFlags)
	} else {
		logger.debug = nil
	}
}

func (logger *Logger) Info(fmt string, v ...any) {
	logger.info.Printf(fmt, v...)
}

func (logger *Logger) Debug(fmt string, v ...any) {
	if logger.debug != nil {
		logger.debug.Printf(fmt, v...)
	}
}

func (logger *Logger) Error(fmt string, v ...any) {
	logger.error.Printf(fmt, v...)
}

func (logger *Logger) Fatal(fmt string, v ...any) {
	logger.error.Fatalf(fmt, v...)
}
