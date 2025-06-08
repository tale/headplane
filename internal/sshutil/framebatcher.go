package sshutil

import (
	"io"
	"sync"
	"time"

	"github.com/tale/headplane/agent/internal/util"
)

type FrameBatcher struct {
	mu       sync.Mutex
	buffer   []byte
	writer   io.Writer
	timer    *time.Timer
	interval time.Duration
	done     chan struct{}
}

func NewFrameBatcher(writer io.Writer, interval time.Duration) *FrameBatcher {
	return &FrameBatcher{
		writer:   writer,
		interval: interval,
		done:     make(chan struct{}),
	}
}

func (b *FrameBatcher) QueueMsg(msg []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.buffer = append(b.buffer, msg...)
	if b.timer != nil {
		b.timer.Stop()
	}

	b.timer = time.AfterFunc(b.interval, b.flush)
}

func (b *FrameBatcher) flush() {
	log := util.GetLogger()

	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.buffer) == 0 {
		return
	}

	_, err := b.writer.Write(b.buffer)
	if err != nil {
		log.Error("Failed to write batched message: %v", err)
	}

	b.buffer = nil
}

func (b *FrameBatcher) Close() {
	close(b.done)
	b.flush()
}
